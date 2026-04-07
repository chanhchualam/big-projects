class Budget {
  final int? id;
  final int userId;
  final int? categoryId;
  final double amount;
  final String period; // 'daily', 'weekly', 'monthly', 'yearly'
  final String startDate;
  final String? endDate;
  final String createdAt;
  final String? updatedAt;

  Budget({
    this.id,
    required this.userId,
    this.categoryId,
    required this.amount,
    required this.period,
    required this.startDate,
    this.endDate,
    required this.createdAt,
    this.updatedAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'user_id': userId,
      'category_id': categoryId,
      'amount': amount,
      'period': period,
      'start_date': startDate,
      'end_date': endDate,
      'created_at': createdAt,
      'updated_at': updatedAt,
    };
  }

  factory Budget.fromMap(Map<String, dynamic> map) {
    return Budget(
      id: map['id'] as int?,
      userId: map['user_id'] as int,
      categoryId: map['category_id'] as int?,
      amount: (map['amount'] as num).toDouble(),
      period: map['period'] as String,
      startDate: map['start_date'] as String,
      endDate: map['end_date'] as String?,
      createdAt: map['created_at'] as String,
      updatedAt: map['updated_at'] as String?,
    );
  }
}

