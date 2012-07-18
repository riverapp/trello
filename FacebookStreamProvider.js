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

	return new FacebookStreamProvider();
})