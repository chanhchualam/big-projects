using DoAnCoSo.Models;

namespace DoAnCoSo.Repositories
{
    public interface ITeacherRepository
    {
        Task<IEnumerable<Teacher>> GetAllAsync();
        Task<Teacher> GetByIdAsync(int id);
        Task AddAsync(Teacher teacher);
        Task UpdateAsync(Teacher teacher);
        Task DeleteAsync(int id);
    }
}
