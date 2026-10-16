using DoAnCoSo.Models;
using DoAnCoSo.Repositories;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using DoAnCoSo.DataAccess;

namespace DoAnCoSo.Controllers
{
    public class TeacherController : Controller
    {
        private readonly ITeacherRepository _teacherRepository;
        private readonly ICenterRepository _centerRepository;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ApplicationDbContext _context;

        public TeacherController(ITeacherRepository teacherRepository, ICenterRepository centerRepository, UserManager<ApplicationUser> userManager, ApplicationDbContext context)
        {
            _teacherRepository = teacherRepository;
            _centerRepository = centerRepository;
            _userManager = userManager;
            _context = context;
        }

        // Hiển thị danh sách giáo viên
        public async Task<IActionResult> Index()
        {
            var teachers = await _teacherRepository.GetAllAsync();
            return View(teachers);
        }

        // Hiển thị form thêm giáo viên mới
        public async Task<IActionResult> Add()
        {
            var centers = await _centerRepository.GetAllAsync();
            ViewBag.Centers = new SelectList(centers, "Id", "Name");
            return View();
        }

        // Xử lý thêm giáo viên mới
        [HttpPost]
        public async Task<IActionResult> Add(Teacher teacher, IFormFile imageUrl)
        {
            if (ModelState.IsValid)
            {
                if (imageUrl != null)
                {
                    teacher.ImageUrl = await SaveImage(imageUrl);
                }

                await _teacherRepository.AddAsync(teacher);
                return RedirectToAction(nameof(Index));
            }

            var centers = await _centerRepository.GetAllAsync();
            ViewBag.Centers = new SelectList(centers, "Id", "Name");
            return View(teacher);
        }

        private async Task<string> SaveImage(IFormFile image)
        {
            var savePath = Path.Combine("wwwroot/images", image.FileName);
            using (var fileStream = new FileStream(savePath, FileMode.Create))
            {
                await image.CopyToAsync(fileStream);
            }
            return "/images/" + image.FileName;
        }

        // Hiển thị chi tiết giáo viên
        public async Task<IActionResult> Display(int id)
        {
            var teacher = await _context.Teachers
                .Include(t => t.Center)
                .Include(t => t.Reviews)
                .ThenInclude(r => r.User)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (teacher == null) return NotFound();

            var user = await _userManager.GetUserAsync(User);
            ViewBag.CurrentUserId = user?.Id;

            ViewBag.NewReview = new Review { TeacherId = id };

            return View(teacher);
        }


        // Hiển thị form cập nhật giáo viên
        public async Task<IActionResult> Update(int id)
        {
            var teacher = await _teacherRepository.GetByIdAsync(id);
            if (teacher == null)
            {
                return NotFound();
            }

            var centers = await _centerRepository.GetAllAsync();
            ViewBag.Centers = new SelectList(centers, "Id", "Name", teacher.CenterId);
            return View(teacher);
        }

        // Xử lý cập nhật giáo viên
        [HttpPost]
        public async Task<IActionResult> Update(int id, Teacher teacher, IFormFile imageUrl)
        {
            ModelState.Remove("ImageUrl");
            if (id != teacher.Id)
            {
                return NotFound();
            }

            if (ModelState.IsValid)
            {
                var existingTeacher = await _teacherRepository.GetByIdAsync(id);

                if (imageUrl == null)
                {
                    teacher.ImageUrl = existingTeacher.ImageUrl;
                }
                else
                {
                    teacher.ImageUrl = await SaveImage(imageUrl);
                }

                existingTeacher.Name = teacher.Name;
                existingTeacher.Description = teacher.Description;
                existingTeacher.Gender = teacher.Gender;
                existingTeacher.CenterId = teacher.CenterId;
                existingTeacher.ImageUrl = teacher.ImageUrl;

                await _teacherRepository.UpdateAsync(existingTeacher);
                return RedirectToAction(nameof(Index));
            }

            var centers = await _centerRepository.GetAllAsync();
            ViewBag.Centers = new SelectList(centers, "Id", "Name");
            return View(teacher);
        }

        // Hiển thị xác nhận xóa giáo viên
        public async Task<IActionResult> Delete(int id)
        {
            var teacher = await _teacherRepository.GetByIdAsync(id);
            if (teacher == null)
            {
                return NotFound();
            }
            return View(teacher);
        }

        // Xử lý xóa giáo viên
        [HttpPost, ActionName("DeleteConfirmed")]
        public async Task<IActionResult> DeleteConfirmed(int id)
        {
            await _teacherRepository.DeleteAsync(id);
            return RedirectToAction(nameof(Index));
        }

        [HttpPost]
        public async Task<IActionResult> AddReview(int teacherId, string content, int rating)
        {
            var userId = _userManager.GetUserId(User);
            if (userId == null) return RedirectToAction("Login", "Account");

            var review = new Review
            {
                TeacherId = teacherId,
                Content = content,
                Rating = rating,
                UserId = userId,
                CreatedAt = DateTime.Now
            };

            _context.Reviews.Add(review);
            await _context.SaveChangesAsync();

            return RedirectToAction("Display", new { id = teacherId });
        }

        [HttpPost]
        public async Task<IActionResult> EditReview(int id, string content, int rating)
        {
            var review = await _context.Reviews.FindAsync(id);
            if (review == null) return NotFound();

            var userId = _userManager.GetUserId(User);
            if (review.UserId != userId) return Forbid();

            review.Content = content;
            review.Rating = rating;
            await _context.SaveChangesAsync();

            return RedirectToAction("Display", new { id = review.TeacherId });
        }

        [HttpPost]
        public async Task<IActionResult> DeleteReview(int id)
        {
            var review = await _context.Reviews.FindAsync(id);
            if (review == null) return NotFound();

            var userId = _userManager.GetUserId(User);
            if (review.UserId != userId) return Forbid();

            int teacherId = review.TeacherId;

            _context.Reviews.Remove(review);
            await _context.SaveChangesAsync();

            return RedirectToAction("Display", new { id = teacherId });
        }

    }

}
