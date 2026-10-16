import 'package:flutter/foundation.dart';
import 'package:smartbudget/models/account_model.dart';
import 'package:smartbudget/services/account_service.dart';

class AccountProvider with ChangeNotifier {
  final AccountService _accountService = AccountService();
  List<Account> _accounts = [];
  bool _isLoading = false;

  List<Account> get accounts => _accounts;
  bool get isLoading => _isLoading;

  Future<void> loadAccounts(int userId) async {
    _isLoading = true;
    notifyListeners();

    try {
      _accounts = await _accountService.getAccountsByUser(userId);
    } catch (e) {
      debugPrint('Error loading accounts: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> addAccount(Account account) async {
    try {
      final id = await _accountService.insertAccount(account);
      if (id != null) {
        await loadAccounts(account.userId);
        return true;
      }
      return false;
    } catch (e) {
      debugPrint('Error adding account: $e');
      return false;
    }
  }

  Future<bool> updateAccount(Account account) async {
    try {
      await _accountService.updateAccount(account);
      await loadAccounts(account.userId);
      return true;
    } catch (e) {
      debugPrint('Error updating account: $e');
      return false;
    }
  }

  Future<bool> deleteAccount(int accountId, int userId) async {
    try {
      await _accountService.deleteAccount(accountId);
      await loadAccounts(userId);
      return true;
    } catch (e) {
      debugPrint('Error deleting account: $e');
      return false;
    }
  }

  double getTotalBalance() {
    return _accounts.fold(0.0, (sum, account) => sum + account.balance);
  }
}

