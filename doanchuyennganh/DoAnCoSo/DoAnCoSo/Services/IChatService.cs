namespace DoAnCoSo.Services
{
    public interface IChatService
    {
        Task<string> GetChatResponseAsync(string userMessage, string? userId = null);
    }
}

