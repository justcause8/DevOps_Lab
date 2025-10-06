using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using questionnaire.questionnaire.Authentication;
using questionnaire.questionnaire.DTOs;
using questionnaire.questionnaire.Models;
using System.Security.Claims;
using Newtonsoft.Json;
using static System.Net.WebRequestMethods;
namespace questionnaire.questionnaire.Controllers
{
    [Route("user")]
    public class UserController : ControllerBase
    {
        private readonly QuestionnaireContext _context;

        public UserController(QuestionnaireContext context)
        {
            _context = context;
        }

        // Получение данных текущего пользователя
        [HttpGet("current")]
        [Authorize]
        public async Task<ActionResult<User>> GetCurrentUser()
        {
            var userIdClaim = User.FindFirstValue(AuthOptions.UserIdClaimType);
            if (!int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized("Ошибка получения userId из токена.");
            }

            var user = await _context.Users.FindAsync(userId);
            if (user == null)
            {
                return NotFound("Пользователь не найден.");
            }

            return Ok(new
            {
                nick = user.Username,
                email = user.Email,
                password = "" // Пароль не возвращается
            });
        }

        // Обновление данных текущего пользователя
        [HttpPut("update")]
        [Authorize]
        public async Task<IActionResult> UpdateUser([FromBody] UpdateUserRequest request)
        {
            var userIdClaim = User.FindFirstValue(AuthOptions.UserIdClaimType);
            if (!int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized("Ошибка получения userId из токена.");
            }

            var user = await _context.Users.FindAsync(userId);
            if (user == null)
            {
                return NotFound("Пользователь не найден.");
            }

            // Проверка уникальности нового имени пользователя
            if (!string.IsNullOrEmpty(request.Nick) && request.Nick != user.Username)
            {
                bool isUsernameTaken = await _context.Users.AnyAsync(u => u.Username == request.Nick && u.Id != userId);
                if (isUsernameTaken)
                {
                    return BadRequest("Имя пользователя уже занято.");
                }
            }

            // Проверка уникальности новой электронной почты
            if (!string.IsNullOrEmpty(request.Email) && request.Email != user.Email)
            {
                bool isEmailTaken = await _context.Users.AnyAsync(u => u.Email == request.Email && u.Id != userId);
                if (isEmailTaken)
                {
                    return BadRequest("Email уже занят.");
                }
            }

            // Обновляем поля, если они переданы в запросе
            if (!string.IsNullOrEmpty(request.Nick))
            {
                user.Username = request.Nick;
            }
            if (!string.IsNullOrEmpty(request.Email))
            {
                user.Email = request.Email;
            }
            if (!string.IsNullOrEmpty(request.Password))
            {
                user.PasswordHash = HashPassword(request.Password); // Хэшируем новый пароль
            }

            _context.Users.Update(user);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Данные успешно обновлены.",
                user = new
                {
                    user.Username,
                    user.Email
                }
            });
        }

        
        // Отображение списка анкет
        [HttpGet("questionnaires")]
        [Authorize]
        public async Task<IActionResult> GetUserQuestionnaires()
        {
            var userIdClaim = User.FindFirstValue(AuthOptions.UserIdClaimType);
            if (!int.TryParse(userIdClaim, out int currentUserId))
            {
                return Unauthorized("Не удалось получить ID пользователя.");
            }

            var questionnaires = await _context.Questionnaires
                .Where(q => q.UserId == currentUserId)
                .Select(q => new
                {
                    q.Id,
                    q.Title,
                    q.CreatedAt,
                    q.IsPublished,
                    Link = $"http://localhost:3000/anketa#/Answers/{q.AccessLinkToken}",
                    //Link = $"https://justcause8.github.io/anketa/#/Answers/{q.AccessLinkToken}",
                    q.AccessLinkToken
                })
                .ToListAsync();
            foreach (var q in questionnaires)
            {
                Console.WriteLine($"ID: {q.Id}, Title: {q.Title}, AccessLinkToken: {q.AccessLinkToken}");
            }
            return Ok(new
            {
                questionnaires
            });
        }

        private string HashPassword(string password)
        {
            var hasher = new PasswordHasher<User>();
            return hasher.HashPassword(null, password);
        }
    }


    // Эндпоинт для создания анкеты
    [Route("questionnaire")]
    public class QuestionnaireController : ControllerBase
    {
        private readonly QuestionnaireContext _context;

        public QuestionnaireController(QuestionnaireContext context)
        {
            _context = context;
        }

        private async Task<(int? userId, int? anonymousId)> GetUserIdAndAnonymousIdAsync()
        {
            var userIdClaim = User.FindFirstValue(AuthOptions.UserIdClaimType);
            int? userId = null;
            int? anonymousId = null;

            if (userIdClaim != null && int.TryParse(userIdClaim, out int parsedUserId))
            {
                userId = parsedUserId; // Авторизованный пользователь
            }
            else
            {
                var sessionIdHeader = Request.Headers["X-Session-Id"].ToString();
                if (!string.IsNullOrEmpty(sessionIdHeader) && Guid.TryParse(sessionIdHeader, out Guid parsedSessionId))
                {
                    var anonymousUser = await _context.Anonymous.FirstOrDefaultAsync(a => a.SessionId == parsedSessionId);
                    if (anonymousUser == null)
                    {
                        throw new UnauthorizedAccessException("Неверный или потерянный SessionId для анонимного пользователя.");
                    }
                    anonymousId = anonymousUser.Id;
                }
            }

            if (userId == null && anonymousId == null)
            {
                throw new UnauthorizedAccessException("Отсутствует проверка подлинности или действительный идентификатор сеанса.");
            }

            return (userId, anonymousId);
        }

        private async Task<int> CalculateNextOrder(int questionId)
        {
            // Находим максимальный порядковый номер среди существующих вариантов ответов
            var maxOrder = await _context.Options
                .Where(o => o.QuestionId == questionId)
                .MaxAsync(o => (int?)o.Order) ?? 0;

            // Возвращаем следующий порядковый номер
            return maxOrder + 1;
        }


        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // МЕТОДЫ АНКЕТЫ

        // Создание анкеты
        [HttpPost("create")]
        [Authorize]
        public async Task<IActionResult> CreateQuestionnaire([FromBody] CreateQuestionnaire request)
        {
            // Получаем ID пользователя или анонимного пользователя
            var (userId, _) = await GetUserIdAndAnonymousIdAsync();
            if (userId == null)
            {
                return Unauthorized("Ошибка получения userId из токена.");
            }

            var questionnaire = new Questionnaire
            {
                Title = request.Title,
                TypeQuestionnaireId = 1,
                UserId = userId.Value,
                CreatedAt = DateTime.UtcNow,
                IsPublished = true,
                AccessLinkToken = Guid.NewGuid()
            };

            await _context.Questionnaires.AddAsync(questionnaire);
            await _context.SaveChangesAsync();

            // Формируем ссылку
            var baseUrl = Environment.GetEnvironmentVariable("BASE_URL") ?? "http://localhost:3000";
            var link = $"{baseUrl}/anketa#/Answers/{questionnaire.AccessLinkToken}";

            //var baseUrl = Environment.GetEnvironmentVariable("BASE_URL") ?? "https://justcause8.github.io";
            //var link = $"{baseUrl}/anketa#/Answers/{questionnaire.AccessLinkToken}";

            return Ok(new
            {
                message = "Анкета успешно создана.",
                questionnaireId = questionnaire.Id,
                link
            });
        }

        [HttpGet("update")]
        [Authorize]
        public async Task<IActionResult> GetQuestionnairesWithQuestions()
        {
            var (userId, anonymousId) = await GetUserIdAndAnonymousIdAsync();
            if (userId == null && anonymousId == null)
            {
                return Unauthorized("Не удалось получить ID пользователя.");
            }

            var query = _context.Questionnaires.AsQueryable();

            var questionnaires = await query
                .Include(q => q.Questions.OrderBy(q => q.Id))
                .ThenInclude(q => q.Options.OrderBy(o => o.Order))
                .ToListAsync();

            if (!questionnaires.Any())
            {
                return Ok(new { message = "Анкеты не найдены." });
            }

            var result = questionnaires.Select(q => new
            {
                q.Id,
                q.Title,
                Questions = q.Questions.Select(qs => new
                {
                    qs.Id,
                    qs.Text,
                    qs.QuestionTypeId,
                    Options = qs.Options.Select(o => new
                    {
                        o.Id,
                        o.OptionText,
                        o.Order
                    }).ToList()
                }).ToList()
            }).ToList();

            return Ok(new { questionnaires = result });
        }
        
        // Возвращаем информацию об анкете
        [HttpGet("access/{token}")]
        public async Task<IActionResult> GetQuestionnaireForRespondent(string token)
        {
            Console.WriteLine($"Запрос получен с токеном: {token}");

            // Проверяем, существует ли анкета с таким токеном и опубликована ли она
            var questionnaire = await _context.Questionnaires
                .Include(q => q.Questions.OrderBy(q => q.Id)) // Сортируем вопросы по ID
                    .ThenInclude(q => q.Options.OrderBy(o => o.Order)) // Сортируем варианты ответов по Order
                .FirstOrDefaultAsync(q => q.AccessLinkToken.ToString() == token && q.IsPublished);

            if (questionnaire == null)
            {
                return NotFound(new { message = "Анкета не найдена или не опубликована." });
            }

            // Возвращаем данные анкеты для респондента
            return Ok(new
            {
                title = questionnaire.Title, // Используем нижний регистр
                questions = questionnaire.Questions.Select(q => new
                {
                    id = q.Id, // Нижний регистр
                    text = q.Text, // Нижний регистр
                    questionTypeId = q.QuestionTypeId, // Нижний регистр
                    options = q.Options.Select(o => new
                    {
                        id = o.Id, // Нижний регистр
                        optionText = o.OptionText, // Нижний регистр
                        order = o.Order // Нижний регистр
                    }).ToList()
                }).ToList()
            });
        }
        
        // Обновление статуса анкеты
        [HttpPut("{questionnaireId}/status")]
        [Authorize]
        public async Task<IActionResult> UpdateQuestionnaireStatus(int questionnaireId, [FromBody] UpdateQuestionnaireStatusRequest request)
        {
            // Получаем ID пользователя или анонимного пользователя
            var (userId, _) = await GetUserIdAndAnonymousIdAsync();
            if (userId == null)
            {
                return Unauthorized("Не удалось получить ID пользователя.");
            }

            var questionnaire = await _context.Questionnaires
                .FirstOrDefaultAsync(q => q.Id == questionnaireId && q.UserId == userId);

            if (questionnaire == null)
            {
                return NotFound("Анкета не найдена.");
            }

            // Обновляем статус публикации
            questionnaire.IsPublished = request.IsPublished;
            _context.Questionnaires.Update(questionnaire);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Статус анкеты успешно обновлен.",
                isPublished = questionnaire.IsPublished
            });
        }


        // Вывод полной информации по анкете
        [HttpGet("{questionnaireId}")]
        [Authorize]
        public async Task<IActionResult> GetQuestionnaireById(int questionnaireId)
        {
            Console.WriteLine($"Запрос на получение анкеты с ID: {questionnaireId}");

            var (userId, anonymousId) = await GetUserIdAndAnonymousIdAsync();
            if (userId == null && anonymousId == null)
            {
                Console.WriteLine("Ошибка: Не удалось получить ID пользователя.");
                return Unauthorized("Не удалось получить ID пользователя.");
            }

            // Загружаем все необходимые связанные данные одним запросом
            var questionnaire = await _context.Questionnaires
                .Include(q => q.Questions.OrderBy(qu => qu.Id)) // Сортируем вопросы
                    .ThenInclude(qu => qu.Options.OrderBy(o => o.Order)) // Сортируем опции
                        .ThenInclude(o => o.Answers) // Включаем ответы, связанные с опциями
                            .ThenInclude(a => a.User) // Включаем пользователя для этих ответов
                .Include(q => q.Questions)
                    .ThenInclude(qu => qu.Answers) // Включаем ответы, связанные напрямую с вопросами
                        .ThenInclude(a => a.User) // Включаем пользователя для этих ответов
                .FirstOrDefaultAsync(q => q.Id == questionnaireId);


            if (questionnaire == null)
            {
                Console.WriteLine($"Анкета с ID {questionnaireId} не найдена.");
                return NotFound(new { message = "Анкета не найдена." });
            }

            Console.WriteLine($"Анкета с ID {questionnaireId} успешно найдена.");

            // Проверка прав доступа (остается без изменений)
            var user = await _context.Users
                .Include(u => u.AccessLevel)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
            {
                Console.WriteLine("Ошибка: Пользователь не найден.");
                return Unauthorized("Пользователь не найден.");
            }

            if (questionnaire.UserId != userId && user.AccessLevel?.LevelName != "admin") // Добавил ?. для безопасности
            {
                Console.WriteLine("Ошибка: У пользователя нет прав для просмотра этой анкеты.");
                return StatusCode(403, new { message = "У вас нет прав для просмотра этой анкеты." });
            }

            // Формируем данные для возврата с правильной структурой
            var result = new
            {
                Id = questionnaire.Id, // Имена свойств с большой буквы, как принято в C#
                Title = questionnaire.Title,
                CreatedAt = questionnaire.CreatedAt,
                IsPublished = questionnaire.IsPublished,
                Questions = questionnaire.Questions.Select(q =>
                {
                    // --- Объединяем ВСЕ ответы на этот вопрос в один список ---
                    var allAnswersForQuestion = new List<object>();

                    // 1. Добавляем ответы, связанные напрямую с вопросом (текст, шкала)
                    allAnswersForQuestion.AddRange(q.Answers.Select(a => new
                    {
                        a.Id,
                        Text = a.Text, // Текст ответа (для text, scale)
                        SelectedOptionText = (string)null, // Для этих типов нет выбранной опции
                        a.CreatedAt,
                        UserId = a.UserId ?? anonymousId,
                        UserName = a.User?.Username ?? "Аноним",
                        IsAnonymous = a.UserId == null
                    }));

                    // 2. Добавляем ответы, связанные через опции (radio, checkbox, select)
                    foreach (var option in q.Options)
                    {
                        allAnswersForQuestion.AddRange(option.Answers.Select(a => new
                        {
                            a.Id,
                            Text = (string)null, // Для этих типов основной текст ответа не используется
                            SelectedOptionText = option.OptionText, // Текст ВЫБРАННОЙ опции
                            a.CreatedAt,
                            UserId = a.UserId ?? anonymousId,
                            UserName = a.User?.Username ?? "Аноним",
                            IsAnonymous = a.UserId == null
                        }));
                    }

                    // Сортируем объединенные ответы по времени создания для консистентности
                    allAnswersForQuestion = allAnswersForQuestion
                       .OrderBy(a => ((dynamic)a).CreatedAt)
                       .ToList();


                    // --- Возвращаем данные вопроса с правильным типом и объединенными ответами ---
                    return new
                    {
                        Id = q.Id,
                        Text = q.Text,
                        Type = MapQuestionTypeIdToString(q.QuestionTypeId), // <--- Преобразуем ID в строку
                                                                            // Не отправляем QuestionTypeId, если он не нужен фронтенду
                        Options = q.Options.Select(o => new // Опции нужны фронтенду для отображения возможных вариантов
                        {
                            Id = o.Id,
                            OptionText = o.OptionText,
                            Order = o.Order
                            // Не включаем ответы здесь, т.к. они объединены ниже
                        }).ToList(),
                        Answers = allAnswersForQuestion // <--- Отправляем ЕДИНЫЙ список всех ответов
                    };
                }).ToList()
            };

            return Ok(result);
        }

        // Вспомогательный метод для преобразования ID типа в строку
        private string MapQuestionTypeIdToString(int typeId)
        {
            return typeId switch
            {
                1 => "text",    // Текстовый
                2 => "radio",   // Выбор одного (можно и 'radio')
                3 => "checkbox",// Множественный выбор
                4 => "scale",   // Шкала
                5 => "select",  // Выпадающий список
                _ => "unknown" // Неизвестный тип
            };
        }

        // Метод для редактирования названия анкеты
        [HttpPut("{questionnaireId}/title")]
        [Authorize]
        public async Task<IActionResult> UpdateQuestionnaireTitle(int questionnaireId, [FromBody] UpdateQuestionnaireTitleRequest request)
        {
            if (request == null || string.IsNullOrEmpty(request.NewTitle))
            {
                return BadRequest("Поле 'NewTitle' обязательно.");
            }

            var (userId, _) = await GetUserIdAndAnonymousIdAsync();

            var questionnaire = await _context.Questionnaires
                .FirstOrDefaultAsync(q => q.Id == questionnaireId && q.UserId == userId);

            if (questionnaire == null)
            {
                return NotFound("Анкета не найдена.");
            }

            questionnaire.Title = request.NewTitle;
            _context.Questionnaires.Update(questionnaire);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Название анкеты успешно обновлено.",
                title = questionnaire.Title
            });
        }

        //ИЗМЕНИЛ УДАЛЕНИЕ, ПРОСИЛО КАСКАДНОЕ УДАЛЕНИЕ - НО ВСЕ СДЕЛАНО В ЭТОМ МЕТОДЕ!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!11

        // Метод для удаления анкеты
        [HttpDelete("{questionnaireId}")]
        [Authorize]
        public async Task<IActionResult> DeleteQuestionnaire(int questionnaireId)
        {
            try
            {
                // Проверяем права доступа
                var (userId, _) = await GetUserIdAndAnonymousIdAsync();
                if (userId == null)
                {
                    return Unauthorized("Не удалось получить ID пользователя.");
                }

                // Находим анкету по ID
                var questionnaire = await _context.Questionnaires
                    .Include(q => q.Questions) // Подключаем связанные вопросы
                        .ThenInclude(q => q.Options) // Подключаем варианты ответов
                    .FirstOrDefaultAsync(q => q.Id == questionnaireId && q.UserId == userId);
                if (questionnaire == null)
                {
                    return NotFound("Анкета не найдена.");
                }

                // Удаляем связанные записи
                foreach (var question in questionnaire.Questions)
                {
                    var answers = await _context.Answers.Where(a => a.QuestionId == question.Id).ToListAsync();
                    _context.Answers.RemoveRange(answers);
                    _context.Options.RemoveRange(question.Options); // Удаляем варианты ответов

                }
                _context.Questions.RemoveRange(questionnaire.Questions); // Удаляем вопросы
                _context.Questionnaires.Remove(questionnaire); // Удаляем анкету

                await _context.SaveChangesAsync();

                return Ok(new
                {
                    message = "Анкета успешно удалена."
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка при удалении анкеты: {ex.Message}");
                return StatusCode(500, new
                {
                    message = "Произошла внутренняя ошибка сервера.",
                    error = ex.Message // Для отладки (в продакшене это лучше не выводить)
                });
            }
        }
        //ИЗМЕНИЛ УДАЛЕНИЕ, ПРОСИЛО КАСКАДНОЕ УДАЛЕНИЕ - НО ВСЕ СДЕЛАНО В ЭТОМ МЕТОДЕ!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!11


        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // МЕТОДЫ ВОПРОСОВ

        // Добавление вопроса
        [HttpPost("{questionnaireId}/questions/add-question")]
        [Authorize]
        public async Task<IActionResult> AddQuestionWithOptions(int questionnaireId, [FromBody] AddQuestionRequest request)
        {
            // Проверка на null
            if (request == null)
            {
                return BadRequest("Тело запроса не может быть пустым.");
            }

            // Находим анкету по ID
            var questionnaire = await _context.Questionnaires.FindAsync(questionnaireId);
            if (questionnaire == null)
            {
                return NotFound("Анкета не найдена.");
            }

            // Проверяем права доступа
            var (userId, _) = await GetUserIdAndAnonymousIdAsync();

            // Создаем вопрос
            var question = new Question
            {
                Text = request.Text,
                QuestionnaireId = questionnaireId,
                QuestionTypeId = request.QuestionType
            };

            // Добавляем вопрос в базу данных
            await _context.Questions.AddAsync(question);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Вопрос успешно создан.",
                questionId = question.Id // Возвращаем ID созданного вопроса
            });
        }

        [HttpPut("{questionnaireId}/questions/{questionId}/text")]
        [Authorize]
        public async Task<IActionResult> UpdateQuestionText(int questionnaireId, int questionId, [FromBody] UpdateQuestionTextRequest request)
        {
            // Проверяем права доступа
            var (userId, _) = await GetUserIdAndAnonymousIdAsync();

            // Находим вопрос по ID и ID анкеты
            var question = await _context.Questions
                .FirstOrDefaultAsync(q => q.Id == questionId && q.QuestionnaireId == questionnaireId && q.Questionnaire.UserId == userId);

            if (question == null)
            {
                return NotFound("Вопрос не найден или не принадлежит указанной анкете.");
            }

            // Обновляем текст вопроса
            question.Text = request.NewText;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Текст вопроса успешно обновлен.",
                newText = question.Text
            });
        }

        // Изменение типа вопроса
        [HttpPut("{questionnaireId}/questions/{questionId}/type")]
        [Authorize]
        public async Task<IActionResult> UpdateQuestionType(int questionnaireId, int questionId, [FromBody] UpdateQuestionTypeRequest request)
        {
            // Проверяем права доступа
            var (userId, _) = await GetUserIdAndAnonymousIdAsync();

            // Находим вопрос по ID и ID анкеты
            var question = await _context.Questions
                .Include(q => q.Options) // Подключаем варианты ответов
                .FirstOrDefaultAsync(q => q.Id == questionId && q.QuestionnaireId == questionnaireId && q.Questionnaire.UserId == userId);

            if (question == null)
            {
                return NotFound("Вопрос не найден или не принадлежит указанной анкете.");
            }

            // Определяем, поддерживает ли новый тип вопроса варианты ответов
            bool supportsOptions = request.NewQuestionType == 2 || request.NewQuestionType == 3 || request.NewQuestionType == 5; // 2-Закр, 3-Множ, 5-Выпад

            // Если новый тип не поддерживает варианты ответов, удаляем их
            if (!supportsOptions && question.Options != null && question.Options.Any())
            {
                // Удаляем связанные ответы пользователей
                var answersToRemove = await _context.Answers
                    .Where(a => a.QuestionId == questionId)
                    .ToListAsync();
                if (answersToRemove.Any())
                {
                    _context.Answers.RemoveRange(answersToRemove);
                }

                // Удаляем варианты ответов
                _context.Options.RemoveRange(question.Options);
            }

            // Обновляем тип вопроса
            question.QuestionTypeId = request.NewQuestionType;

            // Сохраняем изменения в базе данных
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Тип вопроса успешно обновлен.",
                questionId = question.Id // Возвращаем тот же ID
            });
        }

        // Удаление вопроса
        [HttpDelete("{questionnaireId}/questions/{questionId}")]
        [Authorize]
        public async Task<IActionResult> DeleteQuestion(int questionnaireId, int questionId)
        {
            // Проверяем права доступа
            var (userId, _) = await GetUserIdAndAnonymousIdAsync();

            // Находим вопрос по ID и ID анкеты
            var question = await _context.Questions
                .Include(q => q.Options) // Подключаем варианты ответов для удаления
                .FirstOrDefaultAsync(q => q.Id == questionId && q.QuestionnaireId == questionnaireId && q.Questionnaire.UserId == userId);

            if (question == null)
            {
                return NotFound("Вопрос не найден или не принадлежит указанной анкете.");
            }

            // Удаляем связанные ответы пользователей
            var answersToRemove = await _context.Answers
                .Where(a => a.QuestionId == questionId)
                .ToListAsync();

            if (answersToRemove.Any())
            {
                _context.Answers.RemoveRange(answersToRemove);
            }

            // Удаляем связанные варианты ответов
            if (question.Options != null && question.Options.Any())
            {
                _context.Options.RemoveRange(question.Options);
            }

            // Удаляем сам вопрос
            _context.Questions.Remove(question);

            // Сохраняем изменения в базе данных
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Вопрос успешно удален."
            });
        }

        // Добавление варианта ответа
        [HttpPost("{questionnaireId}/questions/{questionId}/options")]
        [Authorize]
        public async Task<IActionResult> AddQuestionOption(int questionnaireId, int questionId, [FromBody] AddQuestionOptionRequest request)
        {
            // Проверяем права доступа
            var (userId, _) = await GetUserIdAndAnonymousIdAsync();

            // Находим вопрос по ID и ID анкеты
            var question = await _context.Questions
                .FirstOrDefaultAsync(q => q.Id == questionId && q.QuestionnaireId == questionnaireId && q.Questionnaire.UserId == userId);

            if (question == null)
            {
                return NotFound("Вопрос не найден или не принадлежит указанной анкете.");
            }

            // Получаем текущий максимальный порядок
            var maxOrder = await _context.Options
                .Where(o => o.QuestionId == questionId)
                .MaxAsync(o => (int?)o.Order) ?? 0;

            // Добавляем новый вариант ответа
            var option = new QuestionOption
            {
                QuestionId = questionId,
                OptionText = request.OptionText ?? "",
                Order = maxOrder + 1 // Назначаем следующий порядковый номер
            };

            await _context.Options.AddAsync(option);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Вариант ответа успешно добавлен.",
                optionId = option.Id,
                order = option.Order // Возвращаем порядковый номер для клиента
            });
        }

        [HttpPut("{questionnaireId}/questions/{questionId}/full-update")]
        [Authorize]
        public async Task<IActionResult> FullUpdateQuestion(int questionnaireId, int questionId, [FromBody] FullUpdateQuestionRequest request)
        {
            // Проверяем права доступа
            var (userId, _) = await GetUserIdAndAnonymousIdAsync();

            // Находим вопрос по ID и ID анкеты
            var question = await _context.Questions
                .Include(q => q.Options) // Подключаем варианты ответов
                .FirstOrDefaultAsync(q => q.Id == questionId && q.QuestionnaireId == questionnaireId && q.Questionnaire.UserId == userId);

            if (question == null)
            {
                return NotFound("Вопрос не найден или не принадлежит указанной анкете.");
            }

            // Обновляем текст и тип вопроса
            question.Text = request.NewText;
            question.QuestionTypeId = request.NewQuestionType;

            // Обновляем варианты ответов
            foreach (var optionRequest in request.Options)
            {
                if (optionRequest.IsNew)
                {
                    // Добавляем новый вариант
                    var newOption = new QuestionOption
                    {
                        QuestionId = questionId,
                        OptionText = optionRequest.OptionText,
                        Order = await CalculateNextOrder(questionId) // Рассчитываем порядковый номер
                    };
                    await _context.Options.AddAsync(newOption);
                }
                else
                {
                    // Находим и обновляем существующий вариант
                    var existingOption = question.Options.FirstOrDefault(o => o.Id == optionRequest.Id);
                    if (existingOption != null)
                    {
                        existingOption.OptionText = optionRequest.OptionText;
                    }
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Вопрос и варианты ответов успешно обновлены." });
        }

        // Изменение варианта ответа
        [HttpPut("{questionnaireId}/questions/{questionId}/options/{optionId}")]
        [Authorize]
        public async Task<IActionResult> UpdateQuestionOption(int questionnaireId, int questionId, int optionId, [FromBody] UpdateQuestionOptionRequest request)
        {
            // Проверяем права доступа
            var (userId, _) = await GetUserIdAndAnonymousIdAsync();

            // Находим вариант ответа по ID и ID анкеты
            var option = await _context.Options
                .FirstOrDefaultAsync(o => o.Id == optionId && o.Question.QuestionnaireId == questionnaireId && o.Question.Questionnaire.UserId == userId);

            if (option == null)
            {
                return NotFound("Вариант ответа не найден или не принадлежит указанной анкете.");
            }


            // Обновляем текст варианта ответа
            option.OptionText = request.NewOptionText ?? ""; // Разрешаем пустые строки
            _context.Options.Update(option);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Вариант ответа успешно обновлен.",
                updatedOption = new
                {
                    option.Id,
                    option.OptionText
                }
            });
        }

        // Удаление варианта ответа
        [HttpDelete("{questionnaireId}/questions/{questionId}/options/{optionId}")]
        [Authorize]
        public async Task<IActionResult> DeleteQuestionOption(int questionnaireId, int questionId, int optionId)
        {
            // Проверяем права доступа
            var (userId, _) = await GetUserIdAndAnonymousIdAsync();

            // Находим вариант ответа по ID и ID анкеты
            var option = await _context.Options
                .FirstOrDefaultAsync(o => o.Id == optionId && o.Question.QuestionnaireId == questionnaireId && o.Question.Questionnaire.UserId == userId);

            if (option == null)
            {
                return NotFound("Вариант ответа не найден или не принадлежит указанной анкете.");
            }

            // Удаляем связанные ответы пользователей
            var answersToRemove = await _context.Answers
                .Where(a => a.SelectOption == optionId)
                .ToListAsync();

            if (answersToRemove.Any())
            {
                _context.Answers.RemoveRange(answersToRemove);
            }

            // Удаляем сам вариант ответа
            _context.Options.Remove(option);
            await _context.SaveChangesAsync();

            // Пересчитываем порядковые номера оставшихся вариантов
            var remainingOptions = await _context.Options
                .Where(o => o.QuestionId == questionId)
                .OrderBy(o => o.Order)
                .ToListAsync();

            for (int i = 0; i < remainingOptions.Count; i++)
            {
                remainingOptions[i].Order = i + 1; // Назначаем новые порядковые номера
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Вариант ответа успешно удален."
            });
        }

        // Изменение порядка вариантов ответов
        [HttpPut("{questionnaireId}/questions/{questionId}/options/reorder")]
        [Authorize]
        public async Task<IActionResult> ReorderQuestionOptions(int questionnaireId, int questionId, [FromBody] List<ReorderOptionRequest> requests)
        {
            // Проверяем права доступа
            var (userId, _) = await GetUserIdAndAnonymousIdAsync();

            // Находим вопрос по ID и ID анкеты
            var question = await _context.Questions
                .Include(q => q.Options)
                .FirstOrDefaultAsync(q => q.Id == questionId && q.QuestionnaireId == questionnaireId && q.Questionnaire.UserId == userId);

            if (question == null)
            {
                return NotFound("Вопрос не найден или не принадлежит указанной анкете.");
            }

            // Обновляем порядок вариантов ответов
            foreach (var request in requests)
            {
                var option = question.Options.FirstOrDefault(o => o.Id == request.OptionId);
                if (option != null)
                {
                    option.Order = request.NewOrder;
                }
            }

            _context.Questions.Update(question);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Порядок вариантов ответов успешно обновлен."
            });
        }


        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // МЕТОДЫ ОТВЕТОВ



        // Добавление ответа на вопрос
        [HttpPost("access/{accessLinkToken}/questions/{questionId}/answer")]
        [Authorize]
        public async Task<IActionResult> SubmitAnswer(Guid accessLinkToken, int questionId, [FromBody] AnswerRequest request)
        {
            // Проверка на null
            if (request == null)
            {
                return BadRequest("Тело запроса не может быть пустым.");
            }

            // Находим анкету по ID
            var questionnaire = await _context.Questionnaires
                .FirstOrDefaultAsync(q => q.AccessLinkToken == accessLinkToken);

            if (questionnaire == null)
            {
                return NotFound("Анкета не найдена.");
            }

            // Находим вопрос по ID из пути
            var question = await _context.Questions
                .Include(q => q.Options) // Подключаем варианты ответов
                .FirstOrDefaultAsync(q => q.Id == questionId && q.QuestionnaireId == questionnaire.Id);

            if (question == null)
            {
                return NotFound("Вопрос не найден в указанной анкете.");
            }

            // Проверяем права доступа
            var (userId, anonymousId) = await GetUserIdAndAnonymousIdAsync();

            // Обработка ответа в зависимости от типа вопроса
            switch (question.QuestionTypeId)
            {
                case 1: // Текстовый вопрос
                    if (string.IsNullOrEmpty(request.AnswerText))
                    {
                        return BadRequest("Для текстового вопроса требуется поле 'AnswerText'.");
                    }

                    var textAnswer = new Answer
                    {
                        Text = request.AnswerText,
                        QuestionId = questionId,
                        UserId = userId,
                        AnonymousId = anonymousId,
                        CreatedAt = DateTime.UtcNow
                    };

                    await _context.Answers.AddAsync(textAnswer);
                    await _context.SaveChangesAsync();

                    return Ok(new
                    {
                        message = "Текстовый ответ успешно отправлен.",
                        answerId = textAnswer.Id
                    });

                case 2: // Выбор одного варианта
                    if (!request.AnswerClose.HasValue)
                    {
                        return BadRequest("Для выбора одного варианта требуется поле 'AnswerClose'.");
                    }

                    var singleOption = question.Options.FirstOrDefault(o => o.Order == request.AnswerClose.Value);
                    if (singleOption == null)
                    {
                        return BadRequest($"Неверный вариант ответа: {request.AnswerClose.Value}");
                    }

                    var singleAnswer = new Answer
                    {
                        Text = null,
                        QuestionId = questionId,
                        UserId = userId,
                        AnonymousId = anonymousId,
                        CreatedAt = DateTime.UtcNow,
                        SelectOption = singleOption.Id
                    };

                    await _context.Answers.AddAsync(singleAnswer);
                    await _context.SaveChangesAsync();

                    return Ok(new
                    {
                        message = "Ответ успешно отправлен.",
                        answerId = singleAnswer.Id
                    });

                case 3: // Выбор нескольких вариантов
                    if (request.AnswerMultiple == null || !request.AnswerMultiple.Any())
                    {
                        return BadRequest("Для выбора нескольких вариантов требуется поле 'AnswerMultiple'.");
                    }

                    foreach (var order in request.AnswerMultiple)
                    {
                        var option = question.Options.FirstOrDefault(o => o.Order == order);
                        if (option == null)
                        {
                            return BadRequest($"Неверный вариант ответа: {order}");
                        }

                        var multipleAnswer = new Answer
                        {
                            Text = null,
                            QuestionId = questionId,
                            UserId = userId,
                            AnonymousId = anonymousId,
                            CreatedAt = DateTime.UtcNow,
                            SelectOption = option.Id
                        };

                        await _context.Answers.AddAsync(multipleAnswer);
                    }
                    await _context.SaveChangesAsync();

                    return Ok(new
                    {
                        message = "Ответы успешно отправлены."
                    });

                case 4: // Шкальный вопрос
                    if (!request.AnswerScale.HasValue)
                    {
                        return BadRequest("Для шкального вопроса требуется поле 'AnswerScale'.");
                    }

                    if (request.AnswerScale < 1 || request.AnswerScale > 10)
                    {
                        return BadRequest("Значение шкалы должно быть между 1 и 10.");
                    }

                    var scaleAnswer = new Answer
                    {
                        Text = request.AnswerScale.ToString(),
                        QuestionId = questionId,
                        UserId = userId,
                        AnonymousId = anonymousId,
                        CreatedAt = DateTime.UtcNow
                    };

                    await _context.Answers.AddAsync(scaleAnswer);
                    await _context.SaveChangesAsync();

                    return Ok(new
                    {
                        message = "Шкальный ответ успешно отправлен.",
                        answerId = scaleAnswer.Id
                    });
                case 5: // Выпадающий список (Dropdown)
                        // Проверяем, пришел ли ID опции в поле AnswerClose
                    if (!request.AnswerClose.HasValue)
                    {
                        // Сообщение можно уточнить, что ожидается ID
                        return BadRequest("Для выпадающего списка требуется ID выбранного варианта (в поле AnswerClose).");
                    }

                    // Ищем опцию напрямую по ID, который пришел в AnswerClose
                    var dropdownOption = question.Options.FirstOrDefault(o => o.Id == request.AnswerClose.Value); // <<< ИЗМЕНЕНИЕ ЗДЕСЬ: Ищем по o.Id

                    if (dropdownOption == null)
                    {
                        // Если опция с таким ID не найдена
                        return BadRequest($"Неверный ID варианта ответа: {request.AnswerClose.Value}");
                    }

                    // Создаем ответ, сохраняя ID найденной опции
                    var dropdownAnswer = new Answer
                    {
                        Text = null, // Текст не нужен для выбора из списка
                        QuestionId = questionId,
                        UserId = userId,
                        AnonymousId = anonymousId,
                        CreatedAt = DateTime.UtcNow,
                        SelectOption = dropdownOption.Id // Сохраняем ID выбранной опции
                    };

                    await _context.Answers.AddAsync(dropdownAnswer);
                    await _context.SaveChangesAsync();

                    return Ok(new
                    {
                        message = "Ответ (выпадающий список) успешно отправлен.",
                        answerId = dropdownAnswer.Id
                    });
                default:
                    return BadRequest("Неизвестный тип вопроса.");
            }
        }
    }
}