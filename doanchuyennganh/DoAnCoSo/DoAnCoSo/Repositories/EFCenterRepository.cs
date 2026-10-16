using DoAnCoSo.DataAccess;
using DoAnCoSo.Models;
using Microsoft.EntityFrameworkCore;

namespace DoAnCoSo.Repositories
{
    public class EFCenterRepository : ICenterRepository
    {
        private readonly ApplicationDbContext _context;

        public EFCenterRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<Center>> GetAllAsync()
        {
            return await _context.Centers.ToListAsync();
        }

        public async Task<Center> GetByIdAsync(int id)
        {
            return await _context.Centers.FindAsync(id);
        }

        public async Task AddAsync(Center center)
        {
            _context.Centers.Add(center);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateAsync(Center center)
        {
            _context.Centers.Update(center);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteAsync(int id)
        {
            var center = await _context.Centers.FindAsync(id);
            if (center != null)
            {
                _context.Centers.Remove(center);
                await _context.SaveChangesAsync();
            }
        }
    }

}
