(function(R) {
	var FacebookStreamProvider = function() {
		
	};

	FacebookStreamProvider.prototype.authRequirements = function() {
		return {
			authType: "credentials",
			field1: {
					"name": "Email",
					"type": "email",
					"identifier": "email"
			},
			field2:	{
				"name": "Password",
				"type": "secure",
				"identifier": "password"
			}
		};
	};

	FacebookStreamProvider.prototype.authenticate = function(params) {
		R.createAccount({
			name: params.email,
			secret: params.password,
			identifier: params.email
		});
	};

	return new FacebookStreamProvider();
})