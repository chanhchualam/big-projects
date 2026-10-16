import 'package:flutter/foundation.dart';
import 'package:smartbudget/models/transaction_model.dart';
import 'package:smartbudget/services/transaction_service.dart';

class TransactionProvider with ChangeNotifier {
  final TransactionService _transactionService = TransactionService();
  List<Transaction> _transactions = [];
  bool _isLoading = false;

  List<Transaction> get transactions => _transactions;
  bool get isLoading => _isLoading;

  Future<void> loadTransactions(int userId) async {
    _isLoading = true;
    notifyListeners();

    try {
      _transactions = await _transactionService.getTransactionsByUser(userId);
    } catch (e) {
      debugPrint('Error loading transactions: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> addTransaction(Transaction transaction) async {
    try {
      final id = await _transactionService.insertTransaction(transaction);
      if (id != null) {
        await loadTransactions(transaction.userId);
        return true;
      }
      return false;
    } catch (e) {
      debugPrint('Error adding transaction: $e');
      return false;
    }
  }

  Future<bool> updateTransaction(Transaction transaction) async {
    try {
      await _transactionService.updateTransaction(transaction);
      await loadTransactions(transaction.userId);
      return true;
    } catch (e) {
      debugPrint('Error updating transaction: $e');
      return false;
    }
  }

  Future<bool> deleteTransaction(int transactionId, int userId) async {
    try {
      await _transactionService.deleteTransaction(transactionId);
      await loadTransactions(userId);
      return true;
    } catch (e) {
      debugPrint('Error deleting transaction: $e');
      return false;
    }
  }

  double getTotalIncome(int userId) {
    return _transactions
        .where((t) => t.userId == userId && t.type == 'income')
        .fold(0.0, (sum, t) => sum + t.amount);
  }

  double getTotalExpense(int userId) {
    return _transactions
        .where((t) => t.userId == userId && t.type == 'expense')
        .fold(0.0, (sum, t) => sum + t.amount);
  }
}

