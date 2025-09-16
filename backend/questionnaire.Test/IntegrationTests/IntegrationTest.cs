using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using questionnaire.questionnaire.Authentication;
using questionnaire.questionnaire.Controllers;
using questionnaire.questionnaire.DTOs;
using questionnaire.questionnaire.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;

namespace questionnaire.Test.IntegrationTests
{
    public class IntegrationTest
    {
        private QuestionnaireContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<QuestionnaireContext>()
                .UseInMemoryDatabase(databaseName: "TestDb_" + Guid.NewGuid()) // Уникальное имя для каждого теста
                .Options;

            return new QuestionnaireContext(options);
        }

        [Fact]
        public async Task UpdateUser_IntegrationTest()
        {
            var context = CreateContext();

            var user = new User
            {
                Id = 1,
                Username = "old_nick",
                Email = "old@example.com",
                PasswordHash = "hashed_old_password"
            };
            await context.Users.AddAsync(user);
            await context.SaveChangesAsync();

            var userClaims = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(AuthOptions.UserIdClaimType, "1")
            }, "mock"));

            var controller = new UserController(context)
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext { User = userClaims }
                }
            };

            var updateRequest = new UpdateUserRequest
            {
                Nick = "new_nick",
                Email = "new@example.com",
                Password = "new_password"
            };

            var result = await controller.UpdateUser(updateRequest);
            var okResult = Assert.IsType<OkObjectResult>(result);
            var json = JsonConvert.SerializeObject(okResult.Value);
            var response = JObject.Parse(json);

            Assert.Equal("Данные успешно обновлены.", (string)response["message"]);
            Assert.Equal("new_nick", (string)response["user"]["Username"]);
            Assert.Equal("new@example.com", (string)response["user"]["Email"]);

            var updatedUser = await context.Users.FindAsync(1);
            Assert.NotNull(updatedUser);
            Assert.Equal("new_nick", updatedUser.Username);
            Assert.Equal("new@example.com", updatedUser.Email);
            Assert.NotEqual("hashed_old_password", updatedUser.PasswordHash); // пароль изменился
        }

        [Fact]
        public async Task CreateAndRetrieveQuestionnaire_IntegrationTest()
        {
            var context = CreateContext();
            var user = new User
            {
                Id = 1,
                Username = "testuser",
                Email = "testuser@example.com",
                PasswordHash = "hashed_password"
            };
            await context.Users.AddAsync(user);
            await context.SaveChangesAsync();

            var userClaims = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(AuthOptions.UserIdClaimType, "1")
            }, "mock"));

            var qController = new QuestionnaireController(context)
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext { User = userClaims }
                }
            };

            var createRequest = new CreateQuestionnaire { Title = "Моя первая анкета" };

            // Создаем анкету
            var createResult = await qController.CreateQuestionnaire(createRequest);
            var createOk = Assert.IsType<OkObjectResult>(createResult);

            var createJson = JsonConvert.SerializeObject(createOk.Value);
            var createResponse = JObject.Parse(createJson);
            var questionnaireId = (int)createResponse["questionnaireId"];
            var link = (string)createResponse["link"];
            var accessLinkToken = link.Split('/').Last(); // извлекаем токен из ссылки

            // Получаем анкету по токену (как респондент)
            var getForRespondentResult = await qController.GetQuestionnaireForRespondent(accessLinkToken);
            var respondentOk = Assert.IsType<OkObjectResult>(getForRespondentResult);

            var respondentJson = JsonConvert.SerializeObject(respondentOk.Value);
            var respondentData = JObject.Parse(respondentJson);

            Assert.Equal("Моя первая анкета", (string)respondentData["title"]);
            Assert.NotNull(respondentData["questions"]);
        }

        [Fact]
        public async Task AddQuestionAndOption_IntegrationTest()
        {
            var context = CreateContext();
            var user = new User
            {
                Id = 1,
                Username = "testuser",
                Email = "test@example.com",
                PasswordHash = "hashed_password"
            };

            var questionnaire = new Questionnaire
            {
                Id = 100,
                UserId = 1,
                Title = "Тест",
                IsPublished = true,
                AccessLinkToken = Guid.NewGuid()
            };

            await context.Users.AddAsync(user);
            await context.Questionnaires.AddAsync(questionnaire);
            await context.SaveChangesAsync();

            var userClaims = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(AuthOptions.UserIdClaimType, "1")
            }, "mock"));

            var controller = new QuestionnaireController(context)
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext { User = userClaims }
                }
            };

            // Добавляем вопрос
            var addQuestionRequest = new AddQuestionRequest
            {
                Text = "Какой ваш любимый цвет?",
                QuestionType = 2
            };

            var addQuestionResult = await controller.AddQuestionWithOptions(100, addQuestionRequest);
            var questionOk = Assert.IsType<OkObjectResult>(addQuestionResult);
            var questionJson = JsonConvert.SerializeObject(questionOk.Value);
            var questionResponse = JObject.Parse(questionJson);
            var questionId = (int)questionResponse["questionId"];

            // Добавляем вариант ответа
            var addOptionRequest = new AddQuestionOptionRequest
            {
                OptionText = "Синий"
            };

            var addOptionResult = await controller.AddQuestionOption(100, questionId, addOptionRequest);
            var optionOk = Assert.IsType<OkObjectResult>(addOptionResult);

            var optionJson = JsonConvert.SerializeObject(optionOk.Value);
            var optionResponse = JObject.Parse(optionJson);
            var optionId = (int)optionResponse["optionId"];

            var savedOption = await context.Options.FindAsync(optionId);
            Assert.NotNull(savedOption);
            Assert.Equal("Синий", savedOption.OptionText);
            Assert.Equal(1, savedOption.Order);
            Assert.Equal(questionId, savedOption.QuestionId);
        }

        [Fact]
        public async Task SubmitAnswer_IntegrationTest()
        {
            var context = CreateContext();
            var user = new User
            {
                Id = 1,
                Username = "testuser",
                Email = "test@example.com",
                PasswordHash = "hashed_password"
            };

            var questionnaire = new Questionnaire
            {
                Id = 200,
                UserId = 1,
                Title = "Опрос",
                IsPublished = true,
                AccessLinkToken = Guid.NewGuid()
            };

            var textQuestion = new Question
            {
                Id = 300,
                QuestionnaireId = 200,
                Text = "Ваше имя?",
                QuestionTypeId = 1
            };

            var radioQuestion = new Question
            {
                Id = 301,
                QuestionnaireId = 200,
                Text = "Любимый цвет?",
                QuestionTypeId = 2
            };

            var option = new QuestionOption
            {
                Id = 400,
                QuestionId = 301,
                OptionText = "Красный",
                Order = 1
            };

            await context.Users.AddAsync(user);
            await context.Questionnaires.AddAsync(questionnaire);
            await context.Questions.AddRangeAsync(textQuestion, radioQuestion);
            await context.Options.AddAsync(option);
            await context.SaveChangesAsync();

            var userClaims = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(AuthOptions.UserIdClaimType, "1")
            }, "mock"));

            var controller = new QuestionnaireController(context)
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext { User = userClaims }
                }
            };

            var token = questionnaire.AccessLinkToken.ToString();

            // Отправляем текстовый ответ
            var textAnswerRequest = new AnswerRequest { AnswerText = "Алексей" };
            var textResult = await controller.SubmitAnswer(Guid.Parse(token), 300, textAnswerRequest);
            Assert.IsType<OkObjectResult>(textResult);

            // Отправляем ответ на radio (выбираем вариант с Order=1)
            var radioAnswerRequest = new AnswerRequest { AnswerClose = 1 };
            var radioResult = await controller.SubmitAnswer(Guid.Parse(token), 301, radioAnswerRequest);
            Assert.IsType<OkObjectResult>(radioResult);

            // Проверяем, что ответы сохранились
            var answers = await context.Answers.ToListAsync();
            Assert.Equal(2, answers.Count);

            var textAnswer = answers.First(a => a.QuestionId == 300);
            Assert.Equal("Алексей", textAnswer.Text);
            Assert.Null(textAnswer.SelectOption);

            var radioAnswer = answers.First(a => a.QuestionId == 301);
            Assert.Null(radioAnswer.Text);
            Assert.Equal(400, radioAnswer.SelectOption);
        }
    }
}
