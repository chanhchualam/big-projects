using DoAnCoSo.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DoAnCoSo.Controllers
{
    public class ChatController : Controller
    {
        private readonly IChatService _chatService;
        private readonly ILogger<ChatController> _logger;

        public ChatController(IChatService chatService, ILogger<ChatController> logger)
        {
            _chatService = chatService;
            _logger = logger;
        }

        public IActionResult Index()
        {
            return View();
        }

        [HttpPost]
        public async Task<IActionResult> SendMessage([FromBody] ChatRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest(new { error = "Tin nhắn không được để trống" });
            }

            try
            {
                var userId = User?.Identity?.IsAuthenticated == true ? User.Identity.Name : null;
                var response = await _chatService.GetChatResponseAsync(request.Message, userId);
                
                return Ok(new { response = response });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi xử lý tin nhắn chat");
                return StatusCode(500, new { error = "Đã xảy ra lỗi khi xử lý tin nhắn" });
            }
        }
    }

    public class ChatRequest
    {
        public string Message { get; set; } = string.Empty;
    }
}

