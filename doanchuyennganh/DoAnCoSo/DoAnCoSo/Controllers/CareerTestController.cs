using DoAnCoSo.DataAccess;
using DoAnCoSo.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DoAnCoSo.Controllers
{
    [Authorize]
    public class CareerTestController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;

        public CareerTestController(ApplicationDbContext context, UserManager<ApplicationUser> userManager)
        {
            _context = context;
            _userManager = userManager;
        }

        // GET: CareerTest
        public IActionResult Index()
        {
            return View();
        }

        // POST: CareerTest/Submit
        [HttpPost]
        public async Task<IActionResult> Submit([FromBody] TestAnswers answers)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            // Tính điểm cho từng nhóm Holland
            var hollandScores = new Dictionary<string, int>
            {
                { "R", 0 }, // Realistic
                { "I", 0 }, // Investigative
                { "A", 0 }, // Artistic
                { "S", 0 }, // Social
                { "E", 0 }, // Enterprising
                { "C", 0 }  // Conventional
            };

            // Map answers to Holland codes
            foreach (var answer in answers.Answers)
            {
                var code = GetHollandCode(answer.QuestionId, answer.Choice);
                if (hollandScores.ContainsKey(code))
                {
                    hollandScores[code] += answer.Score;
                }
            }

            // Tìm mã Holland cao nhất
            var topCode = hollandScores.OrderByDescending(x => x.Value).First().Key;
            var recommendedMajors = await GetRecommendedMajors(topCode);

            // Lưu kết quả
            var studentProfile = await _context.StudentProfiles
                .FirstOrDefaultAsync(s => s.UserId == user.Id);

            if (studentProfile == null)
            {
                studentProfile = new StudentProfile
                {
                    UserId = user.Id,
                    CreatedAt = DateTime.Now
                };
                _context.StudentProfiles.Add(studentProfile);
                await _context.SaveChangesAsync();
            }

            var testResult = new CareerTestResult
            {
                StudentProfileId = studentProfile.Id,
                HollandCode = topCode,
                RecommendedMajors = System.Text.Json.JsonSerializer.Serialize(recommendedMajors.Select(m => new { m.Id, m.Name })),
                TestAnswers = System.Text.Json.JsonSerializer.Serialize(answers.Answers),
                Analysis = GenerateAnalysis(topCode, hollandScores),
                CreatedAt = DateTime.Now
            };

            _context.CareerTestResults.Add(testResult);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                hollandCode = topCode,
                hollandScores = hollandScores,
                recommendedMajors = recommendedMajors.Take(5).Select(m => new { m.Id, m.Name, m.Description }),
                analysis = testResult.Analysis,
                testResultId = testResult.Id
            });
        }

        // GET: CareerTest/Result/5
        public async Task<IActionResult> Result(int id)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var result = await _context.CareerTestResults
                .Include(r => r.StudentProfile)
                .FirstOrDefaultAsync(r => r.Id == id && r.StudentProfile.UserId == user.Id);

            if (result == null) return NotFound();

            var recommendedIds = System.Text.Json.JsonSerializer.Deserialize<List<dynamic>>(result.RecommendedMajors ?? "[]");
            var majors = new List<Major>();

            if (recommendedIds != null)
            {
                foreach (var item in recommendedIds)
                {
                    var majorId = int.Parse(item.GetType().GetProperty("Id").GetValue(item).ToString());
                    var major = await _context.Majors.FindAsync(majorId);
                    if (major != null) majors.Add(major);
                }
            }

            ViewBag.Majors = majors;
            return View(result);
        }

        private string GetHollandCode(int questionId, int choice)
        {
            // Simplified mapping - bạn nên tạo bảng Question trong database
            // Mỗi câu hỏi có thể có nhiều lựa chọn với mã Holland khác nhau
            var mappings = new Dictionary<int, Dictionary<int, string>>
            {
                { 1, new Dictionary<int, string> { { 1, "R" }, { 2, "I" }, { 3, "A" } } },
                { 2, new Dictionary<int, string> { { 1, "S" }, { 2, "E" }, { 3, "C" } } },
                // Thêm mapping cho các câu hỏi khác...
            };

            if (mappings.ContainsKey(questionId) && mappings[questionId].ContainsKey(choice))
                return mappings[questionId][choice];

            return "R"; // Default
        }

        private async Task<List<Major>> GetRecommendedMajors(string hollandCode)
        {
            // Map Holland codes to major keywords
            var keywordMap = new Dictionary<string, List<string>>
            {
                { "R", new List<string> { "kỹ thuật", "công nghệ", "xây dựng", "cơ khí" } },
                { "I", new List<string> { "khoa học", "y", "dược", "sinh học", "vật lý" } },
                { "A", new List<string> { "nghệ thuật", "thiết kế", "âm nhạc", "văn học" } },
                { "S", new List<string> { "giáo dục", "tâm lý", "xã hội", "y tế" } },
                { "E", new List<string> { "kinh tế", "quản trị", "marketing", "thương mại" } },
                { "C", new List<string> { "kế toán", "tài chính", "quản lý", "hành chính" } }
            };

            var keywords = keywordMap.ContainsKey(hollandCode) ? keywordMap[hollandCode] : new List<string>();
            var majors = new List<Major>();

            foreach (var keyword in keywords)
            {
                var found = await _context.Majors
                    .Where(m => m.Name.Contains(keyword) || m.Description.Contains(keyword))
                    .ToListAsync();
                majors.AddRange(found);
            }

            return majors.Distinct().ToList();
        }

        private string GenerateAnalysis(string topCode, Dictionary<string, int> scores)
        {
            var descriptions = new Dictionary<string, string>
            {
                { "R", "Bạn phù hợp với các ngành thực tế, kỹ thuật như Kỹ thuật, Công nghệ, Xây dựng." },
                { "I", "Bạn có tính tò mò, thích nghiên cứu. Phù hợp với các ngành Khoa học, Y, Dược, Nghiên cứu." },
                { "A", "Bạn sáng tạo và nghệ thuật. Phù hợp với các ngành Thiết kế, Nghệ thuật, Văn học." },
                { "S", "Bạn thích giúp đỡ người khác. Phù hợp với các ngành Giáo dục, Y tế, Tâm lý học." },
                { "E", "Bạn có khả năng lãnh đạo. Phù hợp với các ngành Kinh tế, Quản trị kinh doanh, Marketing." },
                { "C", "Bạn có tính tổ chức cao. Phù hợp với các ngành Kế toán, Tài chính, Quản lý." }
            };

            return descriptions.ContainsKey(topCode) ? descriptions[topCode] : "Không xác định được loại tính cách.";
        }
    }

    public class TestAnswers
    {
        public List<Answer> Answers { get; set; } = new();
    }

    public class Answer
    {
        public int QuestionId { get; set; }
        public int Choice { get; set; }
        public int Score { get; set; }
    }
}

