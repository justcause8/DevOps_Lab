using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace questionnaire.questionnaire.DTOs
{
    public class FullUpdateQuestionRequest
    {
        public string NewText { get; set; } = null!; // Новый текст вопроса
        public int NewQuestionType { get; set; } // Новый тип вопроса
        public List<QuestionOptionRequest> Options { get; set; } = new(); // Список вариантов ответов
    }

    public class QuestionOptionRequest
    {
        public int? Id { get; set; } // ID варианта (null для новых вариантов)
        public string OptionText { get; set; } = null!; // Текст варианта
        public bool IsNew { get; set; } // Флаг, указывающий, является ли вариант новым
    }
}
