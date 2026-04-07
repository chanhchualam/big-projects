import 'package:smartbudget/models/transaction_model.dart';
import 'package:smartbudget/utils/database_helper.dart';
import 'package:sqflite/sqflite.dart';

class TransactionService {
  final DatabaseHelper _dbHelper = DatabaseHelper.instance;

  Future<int?> insertTransaction(Transaction transaction) async {
    final db = await _dbHelper.database;
    return await db.insert('transactions', transaction.toMap());
  }

  Future<List<Transaction>> getTransactionsByUser(int userId) async {
    final db = await _dbHelper.database;
    final maps = await db.query(
      'transactions',
      where: 'user_id = ?',
      whereArgs: [userId],
      orderBy: 'date DESC, created_at DESC',
    );

    return maps.map((map) => Transaction.fromMap(map)).toList();
  }

  Future<List<Transaction>> getTransactionsByAccount(int accountId) async {
    final db = await _dbHelper.database;
    final maps = await db.query(
      'transactions',
      where: 'account_id = ?',
      whereArgs: [accountId],
      orderBy: 'date DESC',
    );

    return maps.map((map) => Transaction.fromMap(map)).toList();
  }

  Future<List<Transaction>> getTransactionsByDateRange(int userId, String startDate, String endDate) async {
    final db = await _dbHelper.database;
    final maps = await db.query(
      'transactions',
      where: 'user_id = ? AND date BETWEEN ? AND ?',
      whereArgs: [userId, startDate, endDate],
      orderBy: 'date DESC',
    );

    return maps.map((map) => Transaction.fromMap(map)).toList();
  }

  Future<bool> updateTransaction(Transaction transaction) async {
    final db = await _dbHelper.database;
    final now = DateTime.now().toIso8601String();
    final updatedTransaction = Transaction(
      id: transaction.id,
      userId: transaction.userId,
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
      amount: transaction.amount,
      type: transaction.type,
      description: transaction.description,
      date: transaction.date,
      receiptImage: transaction.receiptImage,
      location: transaction.location,
      createdAt: transaction.createdAt,
      updatedAt: now,
    );

    final count = await db.update(
      'transactions',
      updatedTransaction.toMap(),
      where: 'id = ?',
      whereArgs: [transaction.id],
    );

    return count > 0;
  }

  Future<bool> deleteTransaction(int id) async {
    final db = await _dbHelper.database;
    final count = await db.delete(
      'transactions',
      where: 'id = ?',
      whereArgs: [id],
    );

    return count > 0;
  }
}

