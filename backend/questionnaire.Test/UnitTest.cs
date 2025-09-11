//using Xunit;
//using Microsoft.AspNetCore.Mvc;
//using Microsoft.EntityFrameworkCore;
//using System.Threading.Tasks;
//using questionnaire.questionnaire.Controllers;
//using questionnaire.questionnaire.Models;
//using questionnaire.questionnaire.Authentication;
//using questionnaire.questionnaire.DTOs;
//using Moq;

//namespace questionnaire.Tests
//{
//    public class UnitTests
//    {
//        private readonly AccountController _controller;

//        private QuestionnaireContext CreateContext()
//        {
//            var options = new DbContextOptionsBuilder<QuestionnaireContext>()
//                .UseInMemoryDatabase(databaseName: "TestDb_" + Guid.NewGuid()) // ”никальное им€ дл€ каждого теста
//                .Options;

//            return new QuestionnaireContext(options);
//        }

//        [Fact]
//        public async Task Register_UnitTest()
//        {
//            var context = CreateContext();

//            var mockTokenService = new Mock<TokenService>(
//                AuthOptions.KEY,
//                AuthOptions.ISSUER,
//                AuthOptions.AUDIENCE,
//                AuthOptions.LIFETIME
//            );

//            mockTokenService.Setup(s => s.GenerateAccessToken(It.IsAny<User>()))
//                            .Returns("mock_access_token");

//            mockTokenService.Setup(s => s.GenerateRefreshToken())
//                            .Returns("mock_refresh_token");

//            var newUser = new RegisterRequest
//            {
//                Username = "testuser",
//                Email = "unique@example.com",
//                Password = "password123"
//            };

//            var controller = new AccountController(context, mockTokenService.Object);

//            var result = await controller.Register(newUser);

//            var okResult = Assert.IsType<OkObjectResult>(result);
//            var response = Assert.IsType<AuthResponseDto>(okResult.Value);

//            Assert.Equal("mock_access_token", response.access_token);
//            Assert.Equal("mock_refresh_token", response.refresh_token);

//            var savedUser = await context.Users.FirstOrDefaultAsync(u => u.Email == newUser.Email);
//            Assert.NotNull(savedUser);

//            var savedToken = await context.Tokens.FirstOrDefaultAsync(t => t.UserId == savedUser.Id);
//            Assert.NotNull(savedToken);
//        }
//    }
//}