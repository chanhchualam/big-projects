using DoAnCoSo.Models;

namespace DoAnCoSo.Repositories
{
    public interface IMajorRepository
    {
        Task<IEnumerable<Major>> GetAllAsync();
        Task<Major?> GetByIdAsync(int id);
        Task<IEnumerable<Major>> SearchAsync(string? keyword, int? examBlockId, decimal? minScore, decimal? maxScore, string? city);
        Task AddAsync(Major major);
        Task UpdateAsync(Major major);
        Task DeleteAsync(int id);
        Task<IEnumerable<Major>> GetPopularMajorsAsync(int count = 10);
    }
}

