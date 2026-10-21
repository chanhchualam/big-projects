// src/components/FloatingMessenger.jsx
// Nút chat Messenger & Liên hệ cố định góc phải màn hình
import React from 'react';

const MESSENGER_URL = 'https://m.me/1429099050281227';

export default function FloatingMessenger() {
  return (
    <div className="floating-contact-widget" aria-label="Hỗ trợ qua Messenger">
      {/* 1. Nút đỏ 'Liên hệ' phía trên kèm hiệu ứng sóng xung quanh */}
      <a
        href={MESSENGER_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="floating-red-btn"
        title="Liên hệ tư vấn Point TCG"
        aria-label="Liên hệ tư vấn"
      >
        <span className="floating-pulse-ring" />
        <span className="floating-pulse-ring delay" />
        <div className="floating-red-content">
          <svg
            className="floating-chat-icon"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M20 2H4C2.9 2 2 2.9 2 4V16C2 17.1 2.9 18 4 18H18L22 22V4C22 2.9 21.1 2 20 2Z"
              fill="#ffffff"
            />
            <circle cx="8" cy="10" r="1.5" fill="#b91c1c" />
            <circle cx="12" cy="10" r="1.5" fill="#b91c1c" />
            <circle cx="16" cy="10" r="1.5" fill="#b91c1c" />
          </svg>
          <span className="floating-red-text">Liên hệ</span>
        </div>
      </a>

      {/* 2. Nút xanh Messenger chính đè nhẹ góc dưới bên trái */}
      <a
        href={MESSENGER_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="floating-messenger-btn"
        title="Chat với Point TCG qua Facebook Messenger"
        aria-label="Chat Messenger"
      >
        <div className="messenger-icon-circle">
          <svg
            className="messenger-svg"
            viewBox="0 0 36 36"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* White speech bubble */}
            <path
              d="M18 4C10.268 4 4 9.94 4 17.27C4 21.45 6.03 25.19 9.2 27.62V32L13.22 29.8C14.74 30.29 16.34 30.54 18 30.54C25.732 30.54 32 24.6 32 17.27C32 9.94 25.732 4 18 4Z"
              fill="#ffffff"
            />
            {/* Blue lightning bolt inside */}
            <path
              d="M10.5 21.5L16.2 13.8L20.4 17.9L25.5 13.8L19.8 21.5L15.6 17.4L10.5 21.5Z"
              fill="#0084ff"
            />
          </svg>
        </div>
      </a>
    </div>
  );
}
