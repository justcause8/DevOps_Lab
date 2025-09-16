using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace questionnaire.questionnaire.DTOs
{
    public class AuthResponseDto
    {
        public string access_token { get; set; }
        public string refresh_token { get; set; }
    }
}
