import 'package:smartbudget/models/budget_model.dart';
import 'package:smartbudget/utils/database_helper.dart';
import 'package:sqflite/sqflite.dart';

class BudgetService {
  final DatabaseHelper _dbHelper = DatabaseHelper.instance;

  Future<int?> insertBudget(Budget budget) async {
    final db = await _dbHelper.database;
    return await db.insert('budgets', budget.toMap());
  }

  Future<List<Budget>> getBudgetsByUser(int userId) async {
    final db = await _dbHelper.database;
    final maps = await db.query(
      'budgets',
      where: 'user_id = ?',
      whereArgs: [userId],
      orderBy: 'created_at DESC',
    );

    return maps.map((map) => Budget.fromMap(map)).toList();
  }

  Future<Budget?> getBudgetById(int id) async {
    final db = await _dbHelper.database;
    final maps = await db.query(
      'budgets',
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );

    if (maps.isNotEmpty) {
      return Budget.fromMap(maps.first);
    }
    return null;
  }

  Future<bool> updateBudget(Budget budget) async {
    final db = await _dbHelper.database;
    final now = DateTime.now().toIso8601String();
    final updatedBudget = Budget(
      id: budget.id,
      userId: budget.userId,
      categoryId: budget.categoryId,
      amount: budget.amount,
      period: budget.period,
      startDate: budget.startDate,
      endDate: budget.endDate,
      createdAt: budget.createdAt,
      updatedAt: now,
    );

    final count = await db.update(
      'budgets',
      updatedBudget.toMap(),
      where: 'id = ?',
      whereArgs: [budget.id],
    );

    return count > 0;
  }

  Future<bool> deleteBudget(int id) async {
    final db = await _dbHelper.database;
    final count = await db.delete(
      'budgets',
      where: 'id = ?',
      whereArgs: [id],
    );

    return count > 0;
  }
}

