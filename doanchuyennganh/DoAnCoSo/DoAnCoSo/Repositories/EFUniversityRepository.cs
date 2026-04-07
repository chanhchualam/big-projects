using DoAnCoSo.DataAccess;
using DoAnCoSo.Models;
using Microsoft.EntityFrameworkCore;

namespace DoAnCoSo.Repositories
{
    public class EFUniversityRepository : IUniversityRepository
    {
        private readonly ApplicationDbContext _context;

        public EFUniversityRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<University>> GetAllAsync()
        {
            return await _context.Universities.ToListAsync();
        }

        public async Task<University?> GetByIdAsync(int id)
        {
            return await _context.Universities
                .Include(u => u.AdmissionScores)
                    .ThenInclude(a => a.Major)
                .Include(u => u.AdmissionScores)
                    .ThenInclude(a => a.ExamBlock)
                .FirstOrDefaultAsync(u => u.Id == id);
        }

        public async Task<IEnumerable<University>> SearchAsync(string? keyword, string? city, string? type)
        {
            var query = _context.Universities.AsQueryable();

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                keyword = keyword.ToLower();
                query = query.Where(u => 
                    u.Name.ToLower().Contains(keyword) ||
                    u.Code != null && u.Code.ToLower().Contains(keyword));
            }

            if (!string.IsNullOrWhiteSpace(city))
            {
                query = query.Where(u => u.City == city);
            }

            if (!string.IsNullOrWhiteSpace(type))
            {
                query = query.Where(u => u.Type == type);
            }

            return await query.ToListAsync();
        }

        public async Task AddAsync(University university)
        {
            _context.Universities.Add(university);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateAsync(University university)
        {
            _context.Universities.Update(university);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var university = await _context.Universities.FindAsync(id);
            if (university != null)
            {
                _context.Universities.Remove(university);
                await _context.SaveChangesAsync();
            }
        }
    }
}

