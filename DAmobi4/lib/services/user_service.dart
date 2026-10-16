import 'package:smartbudget/models/user_model.dart';
import 'package:smartbudget/utils/database_helper.dart';
import 'package:sqflite/sqflite.dart';
import 'dart:convert';
import 'package:crypto/crypto.dart';

class UserService {
  final DatabaseHelper _dbHelper = DatabaseHelper.instance;

  String _hashPassword(String password) {
    var bytes = utf8.encode(password);
    var digest = sha256.convert(bytes);
    return digest.toString();
  }

  Future<User?> register(String username, String email, String password, String? fullName) async {
    final db = await _dbHelper.database;
    final now = DateTime.now().toIso8601String();
    final hashedPassword = _hashPassword(password);

    final user = User(
      username: username,
      email: email,
      password: hashedPassword,
      fullName: fullName,
      createdAt: now,
    );

    try {
      final id = await db.insert('users', user.toMap());
      if (id != null) {
        return user.copyWith(id: id);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  Future<User?> login(String username, String password) async {
    final db = await _dbHelper.database;
    final hashedPassword = _hashPassword(password);

    final maps = await db.query(
      'users',
      where: 'username = ? AND password = ?',
      whereArgs: [username, hashedPassword],
      limit: 1,
    );

    if (maps.isNotEmpty) {
      return User.fromMap(maps.first);
    }
    return null;
  }

  Future<User?> getUserById(int id) async {
    final db = await _dbHelper.database;
    final maps = await db.query(
      'users',
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );

    if (maps.isNotEmpty) {
      return User.fromMap(maps.first);
    }
    return null;
  }

  Future<bool> updateUser(User user) async {
    final db = await _dbHelper.database;
    final now = DateTime.now().toIso8601String();
    final updatedUser = user.copyWith(updatedAt: now);

    final count = await db.update(
      'users',
      updatedUser.toMap(),
      where: 'id = ?',
      whereArgs: [user.id],
    );

    return count > 0;
  }
}

