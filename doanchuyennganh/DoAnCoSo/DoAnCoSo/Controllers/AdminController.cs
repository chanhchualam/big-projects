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
    [Authorize(Roles = "Admin")]
    public class AdminController : Controller
    {
        private readonly IMajorRepository _majorRepository;
        private readonly IUniversityRepository _universityRepository;
        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;

        public AdminController(
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

        // GET: Admin
        public IActionResult Index()
        {
            return View();
        }

        #region Major Management

        // GET: Admin/Majors
        public async Task<IActionResult> Majors()
        {
            var majors = await _majorRepository.GetAllAsync();
            return View(majors);
        }

        // GET: Admin/Major/Create
        public IActionResult CreateMajor()
        {
            return View();
        }

        // POST: Admin/Major/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> CreateMajor(Major major, IFormFile? imageFile)
        {
            if (ModelState.IsValid)
            {
                if (imageFile != null && imageFile.Length > 0)
                {
                    major.ImageUrl = await SaveImage(imageFile);
                }

                await _majorRepository.AddAsync(major);
                return RedirectToAction(nameof(Majors));
            }
            return View(major);
        }

        // GET: Admin/Major/Edit/5
        public async Task<IActionResult> EditMajor(int id)
        {
            var major = await _majorRepository.GetByIdAsync(id);
            if (major == null) return NotFound();
            return View(major);
        }

        // POST: Admin/Major/Edit/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> EditMajor(int id, Major major, IFormFile? imageFile)
        {
            if (id != major.Id) return NotFound();

            if (ModelState.IsValid)
            {
                try
                {
                    if (imageFile != null && imageFile.Length > 0)
                    {
                        major.ImageUrl = await SaveImage(imageFile);
                    }
                    await _majorRepository.UpdateAsync(major);
                }
                catch (DbUpdateConcurrencyException)
                {
                    if (await _majorRepository.GetByIdAsync(id) == null)
                        return NotFound();
                    throw;
                }
                return RedirectToAction(nameof(Majors));
            }
            return View(major);
        }

        // GET: Admin/Major/Delete/5
        public async Task<IActionResult> DeleteMajor(int id)
        {
            var major = await _majorRepository.GetByIdAsync(id);
            if (major == null) return NotFound();
            return View(major);
        }

        // POST: Admin/Major/Delete/5
        [HttpPost, ActionName("DeleteMajor")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> DeleteMajorConfirmed(int id)
        {
            await _majorRepository.DeleteAsync(id);
            return RedirectToAction(nameof(Majors));
        }

        #endregion

        #region University Management

        // GET: Admin/Universities
        public async Task<IActionResult> Universities()
        {
            var universities = await _universityRepository.GetAllAsync();
            return View(universities);
        }

        // GET: Admin/University/Create
        public IActionResult CreateUniversity()
        {
            return View();
        }

        // POST: Admin/University/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> CreateUniversity(University university, IFormFile? logoFile)
        {
            if (ModelState.IsValid)
            {
                if (logoFile != null && logoFile.Length > 0)
                {
                    university.LogoUrl = await SaveImage(logoFile);
                }

                await _universityRepository.AddAsync(university);
                return RedirectToAction(nameof(Universities));
            }
            return View(university);
        }

        // GET: Admin/University/Edit/5
        public async Task<IActionResult> EditUniversity(int id)
        {
            var university = await _universityRepository.GetByIdAsync(id);
            if (university == null) return NotFound();
            return View(university);
        }

        // POST: Admin/University/Edit/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> EditUniversity(int id, University university, IFormFile? logoFile)
        {
            if (id != university.Id) return NotFound();

            if (ModelState.IsValid)
            {
                try
                {
                    if (logoFile != null && logoFile.Length > 0)
                    {
                        university.LogoUrl = await SaveImage(logoFile);
                    }
                    await _universityRepository.UpdateAsync(university);
                }
                catch (DbUpdateConcurrencyException)
                {
                    if (await _universityRepository.GetByIdAsync(id) == null)
                        return NotFound();
                    throw;
                }
                return RedirectToAction(nameof(Universities));
            }
            return View(university);
        }

        // POST: Admin/University/Delete/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> DeleteUniversity(int id)
        {
            await _universityRepository.DeleteAsync(id);
            return RedirectToAction(nameof(Universities));
        }

        #endregion

        #region ExamBlock Management

        // GET: Admin/ExamBlocks
        public async Task<IActionResult> ExamBlocks()
        {
            var blocks = await _context.ExamBlocks.ToListAsync();
            return View(blocks);
        }

        // GET: Admin/ExamBlock/Create
        public IActionResult CreateExamBlock()
        {
            return View();
        }

        // POST: Admin/ExamBlock/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> CreateExamBlock(ExamBlock block)
        {
            if (ModelState.IsValid)
            {
                _context.Add(block);
                await _context.SaveChangesAsync();
                return RedirectToAction(nameof(ExamBlocks));
            }
            return View(block);
        }

        // GET: Admin/ExamBlock/Edit/5
        public async Task<IActionResult> EditExamBlock(int id)
        {
            var block = await _context.ExamBlocks.FindAsync(id);
            if (block == null) return NotFound();
            return View(block);
        }

        // POST: Admin/ExamBlock/Edit/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> EditExamBlock(int id, ExamBlock block)
        {
            if (id != block.Id) return NotFound();

            if (ModelState.IsValid)
            {
                try
                {
                    _context.Update(block);
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateConcurrencyException)
                {
                    if (!await _context.ExamBlocks.AnyAsync(e => e.Id == id))
                        return NotFound();
                    throw;
                }
                return RedirectToAction(nameof(ExamBlocks));
            }
            return View(block);
        }

        // POST: Admin/ExamBlock/Delete/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> DeleteExamBlock(int id)
        {
            var block = await _context.ExamBlocks.FindAsync(id);
            if (block != null)
            {
                _context.ExamBlocks.Remove(block);
                await _context.SaveChangesAsync();
            }
            return RedirectToAction(nameof(ExamBlocks));
        }

        #endregion

        #region AdmissionScore Management

        // GET: Admin/AdmissionScores
        public async Task<IActionResult> AdmissionScores()
        {
            var scores = await _context.AdmissionScores
                .Include(a => a.Major)
                .Include(a => a.University)
                .Include(a => a.ExamBlock)
                .ToListAsync();
            return View(scores);
        }

        // GET: Admin/AdmissionScore/Create
        public async Task<IActionResult> CreateAdmissionScore()
        {
            await PopulateAdmissionScoreSelectListsAsync();
            return View(new AdmissionScore());
        }

        // POST: Admin/AdmissionScore/Create
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> CreateAdmissionScore(AdmissionScore score)
        {
            if (ModelState.IsValid)
            {
                score.CreatedAt = DateTime.Now;
                _context.Add(score);
                await _context.SaveChangesAsync();
                return RedirectToAction(nameof(AdmissionScores));
            }

            await PopulateAdmissionScoreSelectListsAsync(score);
            return View(score);
        }

        // GET: Admin/AdmissionScore/Edit/5
        public async Task<IActionResult> EditAdmissionScore(int id)
        {
            var score = await _context.AdmissionScores.FindAsync(id);
            if (score == null) return NotFound();

            await PopulateAdmissionScoreSelectListsAsync(score);
            return View(score);
        }

        // POST: Admin/AdmissionScore/Edit/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> EditAdmissionScore(int id, AdmissionScore score)
        {
            if (id != score.Id) return NotFound();

            if (ModelState.IsValid)
            {
                try
                {
                    score.UpdatedAt = DateTime.Now;
                    _context.Update(score);
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateConcurrencyException)
                {
                    if (!await _context.AdmissionScores.AnyAsync(a => a.Id == id))
                        return NotFound();
                    throw;
                }
                return RedirectToAction(nameof(AdmissionScores));
            }

            await PopulateAdmissionScoreSelectListsAsync(score);
            return View(score);
        }

        // POST: Admin/AdmissionScore/Delete/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> DeleteAdmissionScore(int id)
        {
            var score = await _context.AdmissionScores.FindAsync(id);
            if (score != null)
            {
                _context.AdmissionScores.Remove(score);
                await _context.SaveChangesAsync();
            }
            return RedirectToAction(nameof(AdmissionScores));
        }

        #endregion

        private async Task PopulateAdmissionScoreSelectListsAsync(AdmissionScore? selected = null)
        {
            ViewBag.Majors = new SelectList(await _context.Majors.ToListAsync(), "Id", "Name", selected?.MajorId);
            ViewBag.Universities = new SelectList(await _context.Universities.ToListAsync(), "Id", "Name", selected?.UniversityId);
            ViewBag.ExamBlocks = new SelectList(await _context.ExamBlocks.ToListAsync(), "Id", "Name", selected?.ExamBlockId);
        }

        private async Task<string> SaveImage(IFormFile file)
        {
            var fileName = Guid.NewGuid().ToString() + Path.GetExtension(file.FileName);
            var filePath = Path.Combine("wwwroot/images", fileName);
            
            Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);
            
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }
            
            return "/images/" + fileName;
        }
    }
}

