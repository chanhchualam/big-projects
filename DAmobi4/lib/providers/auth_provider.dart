import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartbudget/models/user_model.dart';
import 'package:smartbudget/services/user_service.dart';
import 'package:sqflite/sqflite.dart';
import 'package:smartbudget/utils/database_helper.dart';

class AuthProvider with ChangeNotifier {
  User? _currentUser;
  bool _isAuthenticated = false;

  User? get currentUser => _currentUser;
  bool get isAuthenticated => _isAuthenticated;

  final UserService _userService = UserService();

  AuthProvider() {
    _checkAuthStatus();
  }

  Future<void> _checkAuthStatus() async {
    final prefs = await SharedPreferences.getInstance();
    final userId = prefs.getInt('current_user_id');
    
    if (userId != null) {
      final user = await _userService.getUserById(userId);
      if (user != null) {
        _currentUser = user;
        _isAuthenticated = true;
        notifyListeners();
      }
    }
  }

  Future<bool> login(String username, String password) async {
    try {
      final user = await _userService.login(username, password);
      if (user != null) {
        _currentUser = user;
        _isAuthenticated = true;
        
        final prefs = await SharedPreferences.getInstance();
        await prefs.setInt('current_user_id', user.id!);
        
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  Future<bool> register(String username, String email, String password, String? fullName) async {
    try {
      final user = await _userService.register(username, email, password, fullName);
      if (user != null) {
        _currentUser = user;
        _isAuthenticated = true;
        
        final prefs = await SharedPreferences.getInstance();
        await prefs.setInt('current_user_id', user.id!);
        
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  Future<void> logout() async {
    _currentUser = null;
    _isAuthenticated = false;
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('current_user_id');
    
    notifyListeners();
  }
}

