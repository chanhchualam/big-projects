class User {
  final int? id;
  final String username;
  final String email;
  final String password;
  final String? fullName;
  final String? avatar;
  final String createdAt;
  final String? updatedAt;

  User({
    this.id,
    required this.username,
    required this.email,
    required this.password,
    this.fullName,
    this.avatar,
    required this.createdAt,
    this.updatedAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'username': username,
      'email': email,
      'password': password,
      'full_name': fullName,
      'avatar': avatar,
      'created_at': createdAt,
      'updated_at': updatedAt,
    };
  }

  factory User.fromMap(Map<String, dynamic> map) {
    return User(
      id: map['id'] as int?,
      username: map['username'] as String,
      email: map['email'] as String,
      password: map['password'] as String,
      fullName: map['full_name'] as String?,
      avatar: map['avatar'] as String?,
      createdAt: map['created_at'] as String,
      updatedAt: map['updated_at'] as String?,
    );
  }

  User copyWith({
    int? id,
    String? username,
    String? email,
    String? password,
    String? fullName,
    String? avatar,
    String? createdAt,
    String? updatedAt,
  }) {
    return User(
      id: id ?? this.id,
      username: username ?? this.username,
      email: email ?? this.email,
      password: password ?? this.password,
      fullName: fullName ?? this.fullName,
      avatar: avatar ?? this.avatar,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

