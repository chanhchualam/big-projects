using DoAnCoSo.DataAccess;
using DoAnCoSo.Models;
using Microsoft.EntityFrameworkCore;

namespace DoAnCoSo.Repositories
{
    public class EFTeacherRepository : ITeacherRepository
    {
        private readonly ApplicationDbContext _context;

        public EFTeacherRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<Teacher>> GetAllAsync()
        {
            return await _context.Teachers
                .Include(t => t.Center) // Include thông tin về trung tâm
                .ToListAsync();
        }

        public async Task<Teacher> GetByIdAsync(int id)
        {
            return await _context.Teachers
                .Include(t => t.Center) // Lấy thông tin kèm theo trung tâm
                .FirstOrDefaultAsync(t => t.Id == id);
        }

        public async Task AddAsync(Teacher teacher)
        {
            _context.Teachers.Add(teacher);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateAsync(Teacher teacher)
        {
            _context.Teachers.Update(teacher);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var teacher = await _context.Teachers.FindAsync(id);
            if (teacher != null)
            {
                _context.Teachers.Remove(teacher);
                await _context.SaveChangesAsync();
            }
        }
    }
}
