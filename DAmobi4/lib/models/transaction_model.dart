class Transaction {
  final int? id;
  final int userId;
  final int accountId;
  final int? categoryId;
  final double amount;
  final String type; // 'income' or 'expense'
  final String? description;
  final String date;
  final String? receiptImage;
  final String? location;
  final String createdAt;
  final String? updatedAt;

  Transaction({
    this.id,
    required this.userId,
    required this.accountId,
    this.categoryId,
    required this.amount,
    required this.type,
    this.description,
    required this.date,
    this.receiptImage,
    this.location,
    required this.createdAt,
    this.updatedAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'user_id': userId,
      'account_id': accountId,
      'category_id': categoryId,
      'amount': amount,
      'type': type,
      'description': description,
      'date': date,
      'receipt_image': receiptImage,
      'location': location,
      'created_at': createdAt,
      'updated_at': updatedAt,
    };
  }

  factory Transaction.fromMap(Map<String, dynamic> map) {
    return Transaction(
      id: map['id'] as int?,
      userId: map['user_id'] as int,
      accountId: map['account_id'] as int,
      categoryId: map['category_id'] as int?,
      amount: (map['amount'] as num).toDouble(),
      type: map['type'] as String,
      description: map['description'] as String?,
      date: map['date'] as String,
      receiptImage: map['receipt_image'] as String?,
      location: map['location'] as String?,
      createdAt: map['created_at'] as String,
      updatedAt: map['updated_at'] as String?,
    );
  }
}

