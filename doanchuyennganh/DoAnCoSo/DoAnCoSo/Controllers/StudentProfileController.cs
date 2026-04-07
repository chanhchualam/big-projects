using DoAnCoSo.DataAccess;
using DoAnCoSo.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DoAnCoSo.Controllers
{
    [Authorize]
    public class StudentProfileController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;

        public StudentProfileController(ApplicationDbContext context, UserManager<ApplicationUser> userManager)
        {
            _context = context;
            _userManager = userManager;
        }

        // GET: StudentProfile
        public async Task<IActionResult> Index()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var profile = await _context.StudentProfiles
                .Include(s => s.Favorites)
                    .ThenInclude(f => f.Major)
                .Include(s => s.TestResults)
                .FirstOrDefaultAsync(s => s.UserId == user.Id);

            if (profile == null)
            {
                // Create new profile
                profile = new StudentProfile
                {
                    UserId = user.Id,
                    CreatedAt = DateTime.Now
                };
                _context.StudentProfiles.Add(profile);
                await _context.SaveChangesAsync();
            }

            // Get favorite majors count
            ViewBag.FavoriteMajorsCount = profile.Favorites?.Count ?? 0;
            ViewBag.TestResultsCount = profile.TestResults?.Count ?? 0;

            return View(profile);
        }

        // GET: StudentProfile/Edit
        public async Task<IActionResult> Edit()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var profile = await _context.StudentProfiles
                .FirstOrDefaultAsync(s => s.UserId == user.Id);

            if (profile == null)
            {
                profile = new StudentProfile
                {
                    UserId = user.Id,
                    CreatedAt = DateTime.Now
                };
            }

            return View(profile);
        }

        // POST: StudentProfile/Edit
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Edit(StudentProfile model)
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            if (ModelState.IsValid)
            {
                var profile = await _context.StudentProfiles
                    .FirstOrDefaultAsync(s => s.UserId == user.Id);

                if (profile == null)
                {
                    model.UserId = user.Id;
                    model.CreatedAt = DateTime.Now;
                    _context.StudentProfiles.Add(model);
                }
                else
                {
                    profile.HighSchoolName = model.HighSchoolName;
                    profile.City = model.City;
                    profile.MathScore = model.MathScore;
                    profile.PhysicsScore = model.PhysicsScore;
                    profile.ChemistryScore = model.ChemistryScore;
                    profile.LiteratureScore = model.LiteratureScore;
                    profile.HistoryScore = model.HistoryScore;
                    profile.GeographyScore = model.GeographyScore;
                    profile.EnglishScore = model.EnglishScore;
                    profile.ExpectedScore = model.ExpectedScore;
                    profile.Interests = model.Interests;
                    profile.CareerGoal = model.CareerGoal;
                    profile.UpdatedAt = DateTime.Now;
                }

                await _context.SaveChangesAsync();
                return RedirectToAction(nameof(Index));
            }

            return View(model);
        }

        // GET: StudentProfile/Favorites
        public async Task<IActionResult> Favorites()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Unauthorized();

            var profile = await _context.StudentProfiles
                .Include(s => s.Favorites)
                    .ThenInclude(f => f.Major)
                        .ThenInclude(m => m.AdmissionScores)
                .FirstOrDefaultAsync(s => s.UserId == user.Id);

            if (profile == null)
            {
                return RedirectToAction(nameof(Index));
            }

            var favorites = profile.Favorites?
                .Select(f => f.Major)
                .ToList() ?? new List<Major>();

            return View(favorites);
        }
    }
}

