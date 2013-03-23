// Plugin for Trello to display notifications from boards a user is subscribed
// to.

// The plugin should be wrapped in a function that is immediately executed to
// avoid polluting the global scope which may interfere with other plugins,
// depending on the implementation of the plugin system.
(function() {
	
	// The constructor is required and will be given a delegate that can perform
	// certain actions which are specific to this plugin.
	var Trello = function(delegate) {
		this.delegate = delegate;

		// Also set up the class-scope configuration variables such as access URLs
		// and OAuth credentials.
		this.OAUTH_CONSUMER_KEY = 'b91dd98505d89cb745761cf9269022a9';
		this.OAUTH_CONSUMER_SECRET = '6a975185f3cfa251d9e7649ea95c8d7844212e028e9c0a834fa6ed37550765f3';

		this.oauth_request_token_url = 'https://trello.com/1/OAuthGetRequestToken';
		this.oauth_authorize_token_url = 'https://trello.com/1/OAuthAuthorizeToken?name=River&scope=read,write&expiration=never&oauth_token=';
		this.oauth_access_token_url = 'https://trello.com/1/OAuthGetAccessToken';

		this.notifications_url = 'https://trello.com/1/members/me/notifications?oauth_token=';
	};

	// **authRequirements** is called by River to find out how to create a new
	// stream instance.
	Trello.prototype.authRequirements = function(callback) {
		var self = this;
		this.requestToken(function(err, response) {
			if (err) {
				console.log(err);
				return callback(err);
			}

			// When we get the reults back from the OAuth process we need to parse
			// them using the provided `parseQueryString` function.
			response = parseQueryString(response);

			// We need to store the `oauth_token_secret` across multiple reuests, but
			// plugins should be stateless, so we use the delegate's persistence to
			// store the value.
			self.delegate.persistence.set('secret', response.oauth_token_secret);
			callback({
				authType: "oauth",
				url: self.oauth_authorize_token_url + response.oauth_token
			});
		});
	};

	// Helper method for requesting a request token from Trello.
	Trello.prototype.requestToken = function(callback) {
		var callbackURL = this.delegate.callbackURL();
		HTTP.request({
			url: this.oauth_request_token_url,
			method: 'POST',
			oauth: {
				oauth_consumer_key: this.OAUTH_CONSUMER_KEY,
				oauth_consumer_secret: this.OAUTH_CONSUMER_SECRET,
				oauth_version: '1.0',
				oauth_callback: callbackURL
			}
		}, callback);
	};

	// Called by River with the result of the user's logging in to the Trello
	// `/authorize` endpoint.
	Trello.prototype.authenticate = function(params) {
		var self = this;

		console.log('Authenticating...');
		console.log(params);

		// Swap the request token we have for an access token.
		self.accessToken(params, function(err, response) {
			if (err) {
				console.log(err);
				return;
			}

			console.log('Got access token');

			// Parse the details we get back, containing the access token.
			var auth = parseQueryString(response);
			console.log(auth);
			// Before we create a user, get some more information about the user who
			// has authenticated so that we can fill out the account object.
			// *Note: Trello uses 'me' to signify the current user's account ID.*
			self.getMemberDetails('me', auth, function(err, userDetails) {
				if (err) {
					console.log(err);
					return;
				}
				console.log('Got user details: ' + userDetails);
				userDetails = JSON.parse(userDetails);
				self.delegate.createAccount({
					name: userDetails.fullName,
					identifier: userDetails.id,
					secret: JSON.stringify(auth),
					avatarURL: 'https://trello-avatars.s3.amazonaws.com/' + userDetails.avatar_hash + '/170.png'
				});
			});
		});
	};

	// Helper method to swap the request token in *params* for an access token.
	Trello.prototype.accessToken = function(params, callback) {
		// Retreive that secret we stored earlier in the persistence object.
		var oauth_token_secret = this.delegate.persistence.get('secret');
		console.log('token secret: ' + oauth_token_secret);
		HTTP.request({
			url: this.oauth_access_token_url,
			method: 'POST',
			parameters: {
				'oauth_verifier': params.oauth_verifier
			},
			oauth: {
				oauth_consumer_key: this.OAUTH_CONSUMER_KEY,
				oauth_consumer_secret: this.OAUTH_CONSUMER_SECRET,
				oauth_token: params.oauth_token,
				oauth_token_secret: oauth_token_secret,
				oauth_version: '1.0'
			}
		}, callback);
	};

	// Helper method to get the metadata from a user account on Trello.
	Trello.prototype.getMemberDetails = function(id, auth, callback) {
		HTTP.request({
			url: 'https://api.trello.com/1/members/' + id,
			method: 'GET',
			oauth: {
				oauth_consumer_key: this.OAUTH_CONSUMER_KEY,
				oauth_consumer_secret: this.OAUTH_CONSUMER_SECRET,
				oauth_token: auth.oauth_token,
				oauth_token_secret: auth.oauth_token_secret,
				oauth_version: '1.0'
			}
		}, callback);
	};

	// The update method called by River to return a list of notifications.
	//
	// This uses the **Notification** data type as that creates an appropriate
	// view for this sort of data.
	Trello.prototype.update = function(user, callback) {
		var self = this;
		this.getNotifications(user, function(err, response) {
			if (err) {
				callback(err, null);
				return;
			}
			var notifications = JSON.parse(response);
			var processed = [];
			for (var i = 0; i < notifications.length; i++) {
				var s = new Notification();
				if (Trello.stringLookup[notifications[i].type] === undefined) {
					console.log(notifications[i].type);
					console.log(notifications[i]);
					continue;
				}
				s.text = _.template(Trello.stringLookup[notifications[i].type], notifications[i]);
				s.id = notifications[i].id;
				s.notification = s.text;
				processed.push(s);
			}
			callback(null, processed);
		});
	};

	// Helper method to handle making a request to the notifications API.
	Trello.prototype.getNotifications = function(user, callback) {
		HTTP.request({
			method: 'GET',
			url: this.notifications_url + JSON.parse(user.secret).oauth_token_secret
		}, callback);
	};

	// Called by River to determine how often it should update streams from this
	// plugin.
	Trello.prototype.updatePreferences = function(callback) {
		callback({
			'interval': 900,
			'min': 300,
			'max': 3600
		});
	};

	// Trello's API returns data in a fairly horrible format and so we have a
	// bunch of templates for how to format each type of message. These use
	// Underscore.js templating, which is similar to ERB or JSP.
	Trello.stringLookup = {
		// addAttachmentToCard : 'added an attachment to a card',
		// addChecklistToCard : 'added a checklist to a card',
		addMemberToBoard : '<b><%= memberCreator.fullName %></b> added <b><%= memberAdded.fullName %></b> to <b><%= data.board.name %></b>',
		// addMemberToCard : 'added a member to a card',
		// addMemberToOrganization : 'added a member to an organisation',
		// addToOrganizationBoard : 'added you to an organisation',
		commentCard : '<b><%= memberCreator.fullName %></b> commented on <b><%= data.card.name %></b>: <br/><%= data.text %>',
		// copyCommentCard : 'copied a comment from a card',
		// convertToCardFromCheckItem : 'created a card from a checklist item',
		// copyBoard : 'copied a board',
		// createBoard : 'created a board',
		createdCard : '<b><%= memberCreator.fullName %></b> added <b><%= data.card.name %></b> to <b><%= data.list.name %></b>',
		// copyCard : 'copied a card',
		// createList : 'created a list',
		// createOrganization : 'created an organisation',
		// deleteAttachmentFromCard : 'deleted an attachment from a card',
		// deleteBoardInvitation : 'deleted a board invitation',
		// deleteOrganizationInvitation : 'deleted an organisation invitation',
		// makeAdminOfBoard : 'was made the admin of <%= data.board.name %>',
		// makeNormalMemberOfBoard : 'made you a normal member of a board',
		// makeNormalMemberOfOrganization : 'made you a normal member of an organisation',
		// makeObserverOfBoard : 'made you an observer of a board',
		// memberJoinedTrello : 'joined Trello',
		// moveCardFromBoard : 'moved card from a board',
		// moveListFromBoard : 'moved list from a board',
		// moveCardToBoard : '',
		// moveListToBoard : '',
		// removeAdminFromBoard : '',
		// removeAdminFromOrganization : '',
		// removeChecklistFromCard : '',
		// removeFromOrganizationBoard : '',
		// removeMemberFromCard : '',
		// updateBoard : '',
		// updateCard : '',
		updateCheckItemStateOnCard : '<b><%= memberCreator.fullName %></b> marked <b><%= data.name %></b> as <b><%= data.state %></b>'
		// updateChecklist : '',
		// updateMember : '',
		// updateOrganization : 'updated an organisation'
	};

	// Must register the 'class' with the **PluginManager** with the identifier
	// that was given in the plugin manifest file.
	PluginManager.registerPlugin(Trello, 'me.danpalmer.River.plugins.Trello');

})();