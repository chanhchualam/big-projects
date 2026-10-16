using DoAnCoSo.Models;

namespace DoAnCoSo.Repositories
{
    public interface ICenterRepository
    {
        Task<IEnumerable<Center>> GetAllAsync();
        Task<Center> GetByIdAsync(int id);
        Task AddAsync(Center center);
        Task UpdateAsync(Center center);
        Task DeleteAsync(int id);
    }
}
