using Xunit;
using questionnaire.questionnaire.Authentication;
using questionnaire.questionnaire.Models;
using System;

namespace questionnaire.Tests
{
    public class ModulTest
    {
        [Fact]
        public void GenerateAccessToken_ModulTest()
        {
            var user = new User
            {
                Id = 1,
                Username = "testuser",
                Email = "test@example.com"
            };

            var tokenService = new TokenService(
                AuthOptions.KEY,
                AuthOptions.ISSUER,
                AuthOptions.AUDIENCE,
                AuthOptions.LIFETIME
            );

            var token = tokenService.GenerateAccessToken(user);

            Assert.NotNull(token);
            Assert.IsType<string>(token);
        }
    }
}