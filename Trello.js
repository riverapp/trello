(function() {
	
	var Trello = function(delegate) {
		this.OAUTH_CONSUMER_KEY = 'b91dd98505d89cb745761cf9269022a9';
		this.OAUTH_CONSUMER_SECRET = '6a975185f3cfa251d9e7649ea95c8d7844212e028e9c0a834fa6ed37550765f3';

		this.oauth_request_token_url = 'https://trello.com/1/OAuthGetRequestToken';
		this.oauth_authorize_token_url = 'https://trello.com/1/OAuthAuthorizeToken?name=River&scope=read,write&expiration=never&oauth_token=';
		this.oauth_access_token_url = 'https://trello.com/1/OAuthGetAccessToken';

		this.notifications_url = 'https://trello.com/1/members/me/notifications?oauth_token=';

		this.delegate = delegate;
	};

	Trello.prototype.authRequirements = function(callback) {
		var self = this;
		this.requestToken(function(err, response) {
			if (err) {
				console.log(err);
				return callback(err);
			}
			response = parseQueryString(response);
			self.tmp_secret = response.oauth_token_secret;
			callback({
				authType: "oauth",
				url: self.oauth_authorize_token_url + response.oauth_token
			});
		});
	};

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

	Trello.prototype.authenticate = function(params) {
		var self = this;
		self.accessToken(params, function(err, response) {
			if (err) {
				console.log(err);
				return;
			}
			var auth = parseQueryString(response);

			self.getMemberDetails('me', auth, function(err, userDetails) {
				if (err) {
					console.log(err);
					return;
				}
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

	Trello.prototype.accessToken = function(params, callback) {
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
				oauth_token_secret: this.tmp_secret,
				oauth_version: '1.0'
			}
		}, callback);
	};

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

	Trello.prototype.update = function(user, callback) {
		var self = this;
		this.getNotifications(user, function(err, response) {
			if (err) {
				// console.log(err);
				callback(err, null);
				return;
			}
			var notifications = JSON.parse(response);
			var processed = [];
			for (var i = 0; i < notifications.length; i++) {
				var s = new Notification();
				s.action = self.template(notifications[i].type, notifications[i].data);
				s.subject = notifications[i].memberCreator.fullName;
				s.id = notifications[i].id;
				processed.push(s);
			}
			callback(null, processed);
		});
	};

	Trello.prototype.getNotifications = function(user, callback) {
		HTTP.request({
			method: 'GET',
			url: this.notifications_url + JSON.parse(user.secret).oauth_token_secret
		}, callback);
	};

	Trello.prototype.template = function(key) {
		return _.template.bind(_, Trello.stringLookup[key]);
	};

	Trello.prototype.updatePreferences = function(callback) {
		callback({
			'interval': 900,
			'min': 300,
			'max': 3600
		});
	};

	Trello.stringLookup = {
		addAttachmentToCard : 'added an attachment to a card',
		addChecklistToCard : 'added a checklist to a card',
		addMemberToBoard : 'added a member to a board',
		addMemberToCard : 'added a member to a card',
		addMemberToOrganization : 'added a member to an organisation',
		addToOrganizationBoard : 'added you to an organisation',
		commentCard : 'commented on a card',
		copyCommentCard : 'copied a comment from a card',
		convertToCardFromCheckItem : 'created a card from a checklist item',
		copyBoard : 'copied a board',
		createBoard : 'created a board',
		createCard : 'created a card',
		copyCard : 'copied a card',
		createList : 'created a list',
		createOrganization : 'created an organisation',
		deleteAttachmentFromCard : 'deleted an attachment from a card',
		deleteBoardInvitation : 'deleted a board invitation',
		deleteOrganizationInvitation : 'deleted an organisation invitation',
		makeAdminOfBoard : 'was made the admin of <%= board.name %>',
		makeNormalMemberOfBoard : 'made you a normal member of a board',
		makeNormalMemberOfOrganization : 'made you a normal member of an organisation',
		makeObserverOfBoard : 'made you an observer of a board',
		memberJoinedTrello : 'joined Trello',
		moveCardFromBoard : 'moved card from a board',
		moveListFromBoard : 'moved list from a board',
		moveCardToBoard : '',
		moveListToBoard : '',
		removeAdminFromBoard : '',
		removeAdminFromOrganization : '',
		removeChecklistFromCard : '',
		removeFromOrganizationBoard : '',
		removeMemberFromCard : '',
		updateBoard : '',
		updateCard : '',
		updateCheckItemStateOnCard : '',
		updateChecklist : '',
		updateMember : '',
		updateOrganization : 'updated an organisation'
	};

	PluginManager.registerPlugin(Trello, 'me.danpalmer.River.plugins.Trello');

})();