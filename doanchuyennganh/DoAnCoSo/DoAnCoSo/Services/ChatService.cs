using System.Text;
using System.Text.Json;
using DoAnCoSo.DataAccess;
using DoAnCoSo.Models;
using Microsoft.EntityFrameworkCore;

namespace DoAnCoSo.Services
{
    public class ChatService : IChatService
    {
        private readonly IConfiguration _configuration;
        private readonly HttpClient _httpClient;
        private readonly ILogger<ChatService> _logger;
        private readonly ApplicationDbContext _context;

        public ChatService(
            IConfiguration configuration, 
            IHttpClientFactory httpClientFactory, 
            ILogger<ChatService> logger,
            ApplicationDbContext context)
        {
            _configuration = configuration;
            _httpClient = httpClientFactory.CreateClient();
            _logger = logger;
            _context = context;
        }

        public async Task<string> GetChatResponseAsync(string userMessage, string? userId = null)
        {
            // Kiểm tra nếu có API key OpenAI
            var apiKey = _configuration["OpenAI:ApiKey"];
            if (!string.IsNullOrEmpty(apiKey))
            {
                return await GetOpenAIResponseAsync(userMessage);
            }

            // Nếu không có API key, sử dụng rule-based responses với database
            return await GetRuleBasedResponseAsync(userMessage);
        }

        private async Task<string> GetOpenAIResponseAsync(string userMessage)
        {
            try
            {
                var apiKey = _configuration["OpenAI:ApiKey"];
                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");

                var requestBody = new
                {
                    model = "gpt-3.5-turbo",
                    messages = new[]
                    {
                        new { role = "system", content = "Bạn là một trợ lý AI chuyên tư vấn về ngành học đại học cho học sinh THPT tại Việt Nam. Hãy trả lời một cách thân thiện, chi tiết và hữu ích về các ngành học, cơ hội việc làm, và định hướng nghề nghiệp." },
                        new { role = "user", content = userMessage }
                    },
                    max_tokens = 500,
                    temperature = 0.7
                };

                var json = JsonSerializer.Serialize(requestBody);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync("https://api.openai.com/v1/chat/completions", content);
                response.EnsureSuccessStatusCode();

                var responseContent = await response.Content.ReadAsStringAsync();
                var responseJson = JsonDocument.Parse(responseContent);

                return responseJson.RootElement
                    .GetProperty("choices")[0]
                    .GetProperty("message")
                    .GetProperty("content")
                    .GetString() ?? "Xin lỗi, tôi không thể trả lời câu hỏi này.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi gọi OpenAI API");
                return await GetRuleBasedResponseAsync(userMessage);
            }
        }

        private async Task<string> GetRuleBasedResponseAsync(string userMessage)
        {
            var lowerMessage = userMessage.ToLower();

            // Rule-based responses cho các câu hỏi phổ biến
            if (lowerMessage.Contains("xin chào") || lowerMessage.Contains("hello") || lowerMessage.Contains("chào"))
            {
                return "Xin chào! Tôi là trợ lý AI tư vấn về ngành học đại học. Tôi có thể giúp bạn tìm hiểu về các ngành học, cơ hội việc làm, điểm chuẩn và định hướng nghề nghiệp. Bạn muốn hỏi gì?";
            }

            // Tìm kiếm ngành học từ database
            if (lowerMessage.Contains("ngành"))
            {
                var majorName = ExtractMajorName(userMessage);
                if (!string.IsNullOrEmpty(majorName))
                {
                    var major = await _context.Majors
                        .Include(m => m.AdmissionScores)
                            .ThenInclude(a => a.University)
                        .Include(m => m.AdmissionScores)
                            .ThenInclude(a => a.ExamBlock)
                        .FirstOrDefaultAsync(m => m.Name.ToLower().Contains(majorName.ToLower()) || 
                                                   (m.Code != null && m.Code.ToLower().Contains(majorName.ToLower())));

                    if (major != null)
                    {
                        var response = $"Thông tin về ngành {major.Name}:\n\n";
                        response += $"Mô tả: {major.Description}\n\n";
                        
                        if (major.Duration > 0)
                            response += $"Thời gian đào tạo: {major.Duration} năm\n";
                        if (major.TuitionFee.HasValue)
                            response += $"Học phí: {major.TuitionFee.Value:N0} VNĐ/năm\n";
                        if (!string.IsNullOrEmpty(major.CareerOpportunities))
                            response += $"Cơ hội việc làm: {major.CareerOpportunities}\n";
                        if (!string.IsNullOrEmpty(major.AverageSalary))
                            response += $"Mức lương: {major.AverageSalary}\n";

                        if (major.AdmissionScores.Any())
                        {
                            response += $"\nĐiểm chuẩn (có {major.AdmissionScores.Count} bản ghi):\n";
                            var latestScores = major.AdmissionScores
                                .OrderByDescending(s => s.Year)
                                .ThenByDescending(s => s.Score)
                                .Take(5);
                            foreach (var score in latestScores)
                            {
                                response += $"- {score.University?.Name} ({score.ExamBlock?.Code}): {score.Score} điểm ({score.Year})\n";
                            }
                        }

                        return response;
                    }
                }
            }

            // Tìm kiếm điểm chuẩn
            if (lowerMessage.Contains("điểm chuẩn") || lowerMessage.Contains("điểm"))
            {
                var majorName = ExtractMajorName(userMessage);
                var universityName = ExtractUniversityName(userMessage);

                IQueryable<AdmissionScore> query = _context.AdmissionScores
                    .Include(a => a.Major)
                    .Include(a => a.University)
                    .Include(a => a.ExamBlock);

                if (!string.IsNullOrEmpty(majorName))
                {
                    query = query.Where(a => a.Major.Name.ToLower().Contains(majorName.ToLower()));
                }

                if (!string.IsNullOrEmpty(universityName))
                {
                    query = query.Where(a => a.University.Name.ToLower().Contains(universityName.ToLower()));
                }

                var scores = await query
                    .OrderByDescending(a => a.Year)
                    .ThenByDescending(a => a.Score)
                    .Take(10)
                    .ToListAsync();

                if (scores.Any())
                {
                    var response = "Điểm chuẩn tìm thấy:\n\n";
                    foreach (var score in scores)
                    {
                        response += $"- {score.Major?.Name} tại {score.University?.Name} ({score.ExamBlock?.Code}): {score.Score} điểm ({score.Year})\n";
                    }
                    return response;
                }
            }

            // Tìm kiếm trường đại học
            if (lowerMessage.Contains("trường") || lowerMessage.Contains("đại học"))
            {
                var uniName = ExtractUniversityName(userMessage);
                if (!string.IsNullOrEmpty(uniName))
                {
                    var university = await _context.Universities
                        .FirstOrDefaultAsync(u => u.Name.ToLower().Contains(uniName.ToLower()));

                    if (university != null)
                    {
                        var response = $"Thông tin trường {university.Name}:\n\n";
                        if (!string.IsNullOrEmpty(university.Address))
                            response += $"Địa chỉ: {university.Address}\n";
                        if (!string.IsNullOrEmpty(university.City))
                            response += $"Thành phố: {university.City}\n";
                        if (!string.IsNullOrEmpty(university.Type))
                            response += $"Loại: {university.Type}\n";
                        if (!string.IsNullOrEmpty(university.PhoneNumber))
                            response += $"Điện thoại: {university.PhoneNumber}\n";
                        if (!string.IsNullOrEmpty(university.Website))
                            response += $"Website: {university.Website}\n";
                        return response;
                    }
                }
            }

            if (lowerMessage.Contains("cơ hội việc làm") || lowerMessage.Contains("việc làm"))
            {
                return "Cơ hội việc làm phụ thuộc vào ngành học và năng lực cá nhân. Các ngành có nhu cầu cao: CNTT, Y-Dược, Kỹ thuật, Kinh tế - Tài chính. Quan trọng là bạn cần tích lũy kiến thức, kỹ năng và kinh nghiệm thực tế trong quá trình học.";
            }

            if (lowerMessage.Contains("định hướng") || lowerMessage.Contains("chọn ngành"))
            {
                return "Để chọn ngành phù hợp, bạn nên:\n1. Tìm hiểu sở thích và đam mê của bản thân\n2. Đánh giá năng lực học tập (điểm số các môn)\n3. Nghiên cứu thị trường lao động\n4. Tham khảo ý kiến gia đình và giáo viên\n5. Tìm hiểu về các trường đại học và chương trình đào tạo\nBạn có thể mô tả sở thích của mình để tôi tư vấn cụ thể hơn!";
            }

            // Câu trả lời mặc định
            return "Cảm ơn bạn đã hỏi! Tôi có thể tư vấn về:\n- Thông tin các ngành học\n- Điểm chuẩn đại học\n- Cơ hội việc làm\n- Định hướng nghề nghiệp\n- Tư vấn chọn ngành phù hợp\n\nBạn hãy đặt câu hỏi cụ thể hơn để tôi có thể giúp bạn tốt nhất!";
        }

        private string ExtractMajorName(string message)
        {
            var keywords = new[] { "công nghệ thông tin", "cntt", "it", "y khoa", "y", "dược", "kinh tế", "quản trị", "kế toán" };
            var lower = message.ToLower();
            
            foreach (var keyword in keywords)
            {
                if (lower.Contains(keyword))
                {
                    if (keyword == "cntt" || keyword == "it") return "công nghệ thông tin";
                    if (keyword == "y") return "y khoa";
                    return keyword;
                }
            }

            // Extract từ sau "ngành"
            var index = lower.IndexOf("ngành");
            if (index >= 0)
            {
                var after = message.Substring(index + 5).Trim();
                var words = after.Split(new[] { ' ', ',', '.', '?' }, StringSplitOptions.RemoveEmptyEntries);
                if (words.Length > 0)
                {
                    return words[0];
                }
            }

            return string.Empty;
        }

        private string ExtractUniversityName(string message)
        {
            var lower = message.ToLower();
            var index = lower.IndexOf("trường");
            if (index < 0) index = lower.IndexOf("đại học");
            
            if (index >= 0)
            {
                var after = message.Substring(index).Trim();
                var words = after.Split(new[] { ' ', ',', '.', '?' }, StringSplitOptions.RemoveEmptyEntries);
                if (words.Length > 1)
                {
                    return string.Join(" ", words.Skip(1).Take(3));
                }
            }

            return string.Empty;
        }
    }
}

