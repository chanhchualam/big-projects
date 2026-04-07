class Account {
  final int? id;
  final int userId;
  final String name;
  final String type; // 'cash', 'bank', 'credit_card', 'savings', etc.
  final double balance;
  final String currency;
  final String? color;
  final String? icon;
  final String createdAt;
  final String? updatedAt;

  Account({
    this.id,
    required this.userId,
    required this.name,
    required this.type,
    this.balance = 0,
    this.currency = 'VND',
    this.color,
    this.icon,
    required this.createdAt,
    this.updatedAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'user_id': userId,
      'name': name,
      'type': type,
      'balance': balance,
      'currency': currency,
      'color': color,
      'icon': icon,
      'created_at': createdAt,
      'updated_at': updatedAt,
    };
  }

  factory Account.fromMap(Map<String, dynamic> map) {
    return Account(
      id: map['id'] as int?,
      userId: map['user_id'] as int,
      name: map['name'] as String,
      type: map['type'] as String,
      balance: (map['balance'] as num).toDouble(),
      currency: map['currency'] as String? ?? 'VND',
      color: map['color'] as String?,
      icon: map['icon'] as String?,
      createdAt: map['created_at'] as String,
      updatedAt: map['updated_at'] as String?,
    );
  }
}

