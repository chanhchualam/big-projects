import 'package:smartbudget/models/account_model.dart';
import 'package:smartbudget/utils/database_helper.dart';
import 'package:sqflite/sqflite.dart';

class AccountService {
  final DatabaseHelper _dbHelper = DatabaseHelper.instance;

  Future<int?> insertAccount(Account account) async {
    final db = await _dbHelper.database;
    return await db.insert('accounts', account.toMap());
  }

  Future<List<Account>> getAccountsByUser(int userId) async {
    final db = await _dbHelper.database;
    final maps = await db.query(
      'accounts',
      where: 'user_id = ?',
      whereArgs: [userId],
      orderBy: 'created_at DESC',
    );

    return maps.map((map) => Account.fromMap(map)).toList();
  }

  Future<Account?> getAccountById(int id) async {
    final db = await _dbHelper.database;
    final maps = await db.query(
      'accounts',
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );

    if (maps.isNotEmpty) {
      return Account.fromMap(maps.first);
    }
    return null;
  }

  Future<bool> updateAccount(Account account) async {
    final db = await _dbHelper.database;
    final now = DateTime.now().toIso8601String();
    final updatedAccount = Account(
      id: account.id,
      userId: account.userId,
      name: account.name,
      type: account.type,
      balance: account.balance,
      currency: account.currency,
      color: account.color,
      icon: account.icon,
      createdAt: account.createdAt,
      updatedAt: now,
    );

    final count = await db.update(
      'accounts',
      updatedAccount.toMap(),
      where: 'id = ?',
      whereArgs: [account.id],
    );

    return count > 0;
  }

  Future<bool> deleteAccount(int id) async {
    final db = await _dbHelper.database;
    final count = await db.delete(
      'accounts',
      where: 'id = ?',
      whereArgs: [id],
    );

    return count > 0;
  }
}

