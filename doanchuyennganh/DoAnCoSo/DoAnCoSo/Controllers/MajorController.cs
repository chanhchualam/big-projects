using DoAnCoSo.DataAccess;
using DoAnCoSo.Models;
using DoAnCoSo.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace DoAnCoSo.Controllers
{
    public class MajorController : Controller
    {
        private readonly IMajorRepository _majorRepository;
        private readonly IUniversityRepository _universityRepository;
        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;

        public MajorController(
            IMajorRepository majorRepository,
            IUniversityRepository universityRepository,
            ApplicationDbContext context,
            UserManager<ApplicationUser> userManager)
        {
            _majorRepository = majorRepository;
            _universityRepository = universityRepository;
            _context = context;
            _userManager = userManager;
        }

        // GET: Major
        public async Task<IActionResult> Index(string? keyword, int? examBlockId, decimal? minScore, decimal? maxScore, string? city)
        {
            var majors = await _majorRepository.SearchAsync(keyword, examBlockId, minScore, maxScore, city);
            
            // Load filter options
            ViewBag.ExamBlocks = await _context.ExamBlocks.ToListAsync();
            ViewBag.Cities = await _context.GetDistinctUniversityCitiesAsync();

            ViewBag.Keyword = keyword;
            ViewBag.ExamBlockId = examBlockId;
            ViewBag.MinScore = minScore;
            ViewBag.MaxScore = maxScore;
            ViewBag.City = city;

            return View(majors);
        }

        // GET: Major/Details/5
        public async Task<IActionResult> Details(int id)
        {
            var major = await _majorRepository.GetByIdAsync(id);
            if (major == null)
            {
                return NotFound();
            }

            var profile = await GetStudentProfileForCurrentUserAsync();
            if (profile != null)
            {
                ViewBag.IsFavorite = await _context.MajorFavorites
                    .AnyAsync(f => f.MajorId == id && f.StudentProfileId == profile.Id);
            }

            return View(major);
        }

        // POST: Major/AddFavorite
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> AddFavorite(int majorId)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var studentProfile = await GetOrCreateStudentProfileAsync(user);

            var existingFavorite = await _context.MajorFavorites
                .FirstOrDefaultAsync(f => f.MajorId == majorId && f.StudentProfileId == studentProfile.Id);

            if (existingFavorite == null)
            {
                _context.MajorFavorites.Add(new MajorFavorite
                {
                    MajorId = majorId,
                    StudentProfileId = studentProfile.Id,
                    CreatedAt = DateTime.Now
                });
                await _context.SaveChangesAsync();
            }

            return RedirectToAction(nameof(Details), new { id = majorId });
        }

        // POST: Major/RemoveFavorite
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> RemoveFavorite(int majorId)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var studentProfile = await GetStudentProfileForCurrentUserAsync();
            if (studentProfile == null)
                return RedirectToAction(nameof(Details), new { id = majorId });

            var favorite = await _context.MajorFavorites
                .FirstOrDefaultAsync(f => f.MajorId == majorId && f.StudentProfileId == studentProfile.Id);

            if (favorite != null)
            {
                _context.MajorFavorites.Remove(favorite);
                await _context.SaveChangesAsync();
            }

            return RedirectToAction(nameof(Details), new { id = majorId });
        }

        // GET: Major/Compare
        [Authorize]
        public async Task<IActionResult> Compare(int[] ids)
        {
            if (ids == null || ids.Length == 0)
            {
                return RedirectToAction(nameof(Index));
            }

            var majors = new List<Major>();
            foreach (var id in ids.Take(3)) // Limit to 3 majors
            {
                var major = await _majorRepository.GetByIdAsync(id);
                if (major != null)
                {
                    majors.Add(major);
                }
            }

            return View(majors);
        }

        // GET: Major/AdmissionProbability/5
        [Authorize]
        public async Task<IActionResult> AdmissionProbability(int id, int? universityId)
        {
            var major = await _majorRepository.GetByIdAsync(id);
            if (major == null) return NotFound();

            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var studentProfile = await GetStudentProfileForCurrentUserAsync();

            var admissionScores = await RecentAdmissionScoresForMajor(id, universityId)
                .OrderBy(a => a.Year)
                .ToListAsync();

            // Tính toán tỷ lệ đậu
            var probabilityData = new List<object>();

            if (studentProfile?.ExpectedScore.HasValue == true && admissionScores.Any())
            {
                var studentScore = studentProfile.ExpectedScore.Value;
                
                foreach (var group in admissionScores.GroupBy(a => new { a.UniversityId, a.ExamBlockId }))
                {
                    var scores = group.Select(a => a.Score).ToList();
                    var avgScore = scores.Average();
                    var minScore = scores.Min();
                    var maxScore = scores.Max();
                    var recentScore = group.OrderByDescending(a => a.Year).First().Score;
                    
                    // Tính tỷ lệ đậu
                    var safetyMargin = 1.5m; // Biên độ an toàn
                    var probability = CalculateAdmissionProbability(studentScore, avgScore, minScore, maxScore, recentScore, safetyMargin);

                    probabilityData.Add(new
                    {
                        universityId = group.Key.UniversityId,
                        universityName = group.First().University?.Name,
                        examBlockCode = group.First().ExamBlock?.Code,
                        averageScore = Math.Round(avgScore, 2),
                        minScore = minScore,
                        maxScore = maxScore,
                        recentScore = recentScore,
                        studentScore = studentScore,
                        probability = probability,
                        probabilityText = GetProbabilityText(probability),
                        years = group.Select(a => a.Year).Distinct().ToList(),
                        scores = scores
                    });
                }
            }

            // Lấy dữ liệu cho biểu đồ
            var chartData = admissionScores
                .GroupBy(a => a.Year)
                .Select(g => new
                {
                    year = g.Key,
                    averageScore = Math.Round(g.Average(a => a.Score), 2),
                    minScore = g.Min(a => a.Score),
                    maxScore = g.Max(a => a.Score),
                    count = g.Count()
                })
                .OrderBy(x => x.year)
                .ToList();

            ViewBag.ProbabilityData = probabilityData;
            ViewBag.ChartData = chartData;
            ViewBag.StudentProfile = studentProfile;
            ViewBag.Universities = admissionScores.Select(a => a.University).Distinct().ToList();

            return View(major);
        }

        // API: Get admission score trends for chart
        [HttpGet]
        public async Task<IActionResult> GetScoreTrends(int majorId, int? universityId)
        {
            var admissionScores = await RecentAdmissionScoresForMajor(majorId, universityId).ToListAsync();

            var trends = admissionScores
                .GroupBy(a => a.Year)
                .Select(g => new
                {
                    year = g.Key,
                    average = Math.Round(g.Average(a => a.Score), 2),
                    min = g.Min(a => a.Score),
                    max = g.Max(a => a.Score),
                    count = g.Count()
                })
                .OrderBy(x => x.year)
                .ToList();

            return Json(trends);
        }

        private IQueryable<AdmissionScore> RecentAdmissionScoresForMajor(int majorId, int? universityId)
        {
            var cutoffYear = DateTime.Now.Year - 5;
            return _context.AdmissionScores
                .Include(a => a.University)
                .Include(a => a.ExamBlock)
                .Where(a => a.MajorId == majorId)
                .Where(a => universityId == null || a.UniversityId == universityId)
                .Where(a => a.Year >= cutoffYear);
        }

        private async Task<StudentProfile?> GetStudentProfileForCurrentUserAsync()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return null;
            return await _context.StudentProfiles.FirstOrDefaultAsync(s => s.UserId == user.Id);
        }

        private async Task<StudentProfile> GetOrCreateStudentProfileAsync(ApplicationUser user)
        {
            var profile = await _context.StudentProfiles.FirstOrDefaultAsync(s => s.UserId == user.Id);
            if (profile != null) return profile;

            profile = new StudentProfile
            {
                UserId = user.Id,
                CreatedAt = DateTime.Now
            };
            _context.StudentProfiles.Add(profile);
            await _context.SaveChangesAsync();
            return profile;
        }

        private decimal CalculateAdmissionProbability(decimal studentScore, decimal avgScore, decimal minScore, decimal maxScore, decimal recentScore, decimal safetyMargin)
        {
            // Nếu điểm học sinh cao hơn điểm trung bình + biên độ an toàn -> Khả năng cao
            if (studentScore >= avgScore + safetyMargin)
                return 85; // 85% khả năng đậu

            // Nếu điểm học sinh cao hơn điểm trung bình -> Khả năng trung bình-cao
            if (studentScore >= avgScore)
                return 65;

            // Nếu điểm học sinh cao hơn điểm thấp nhất -> Khả năng trung bình
            if (studentScore >= minScore)
                return 45;

            // Nếu điểm học sinh thấp hơn điểm thấp nhất nhưng gần -> Khả năng thấp
            if (studentScore >= minScore - 2)
                return 25;

            // Khả năng rất thấp
            return 10;
        }

        private string GetProbabilityText(decimal probability)
        {
            if (probability >= 75)
                return "Khả năng đậu cao";
            else if (probability >= 50)
                return "Khả năng đậu trung bình - cao";
            else if (probability >= 30)
                return "Khả năng đậu trung bình";
            else if (probability >= 15)
                return "Khả năng đậu thấp";
            else
                return "Khả năng đậu rất thấp";
        }
    }
}

