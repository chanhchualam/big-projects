using DoAnCoSo.Models;

namespace DoAnCoSo.Repositories
{
    public interface IUniversityRepository
    {
        Task<IEnumerable<University>> GetAllAsync();
        Task<University?> GetByIdAsync(int id);
        Task<IEnumerable<University>> SearchAsync(string? keyword, string? city, string? type);
        Task AddAsync(University university);
        Task UpdateAsync(University university);
        Task DeleteAsync(int id);
    }
}

