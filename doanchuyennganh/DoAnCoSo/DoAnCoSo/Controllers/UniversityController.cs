using DoAnCoSo.DataAccess;
using DoAnCoSo.Models;
using DoAnCoSo.Repositories;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DoAnCoSo.Controllers
{
    public class UniversityController : Controller
    {
        private readonly IUniversityRepository _universityRepository;
        private readonly ApplicationDbContext _context;

        public UniversityController(IUniversityRepository universityRepository, ApplicationDbContext context)
        {
            _universityRepository = universityRepository;
            _context = context;
        }

        // GET: University
        public async Task<IActionResult> Index(string? keyword, string? city, string? type)
        {
            var universities = await _universityRepository.SearchAsync(keyword, city, type);

            ViewBag.Cities = await _context.GetDistinctUniversityCitiesAsync();

            ViewBag.Keyword = keyword;
            ViewBag.City = city;
            ViewBag.Type = type;

            return View(universities);
        }

        // GET: University/Details/5
        public async Task<IActionResult> Details(int id)
        {
            var university = await _universityRepository.GetByIdAsync(id);
            if (university == null)
            {
                return NotFound();
            }

            // Get statistics
            var stats = await _context.AdmissionScores
                .Where(a => a.UniversityId == id)
                .GroupBy(a => a.MajorId)
                .Select(g => new
                {
                    MajorId = g.Key,
                    Count = g.Count(),
                    MinScore = g.Min(s => s.Score),
                    MaxScore = g.Max(s => s.Score),
                    AvgScore = g.Average(s => (double)s.Score)
                })
                .ToListAsync();

            ViewBag.Stats = stats;

            return View(university);
        }
    }
}

