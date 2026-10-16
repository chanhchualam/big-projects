import 'package:flutter/foundation.dart';
import 'package:smartbudget/models/budget_model.dart';
import 'package:smartbudget/services/budget_service.dart';

class BudgetProvider with ChangeNotifier {
  final BudgetService _budgetService = BudgetService();
  List<Budget> _budgets = [];
  bool _isLoading = false;

  List<Budget> get budgets => _budgets;
  bool get isLoading => _isLoading;

  Future<void> loadBudgets(int userId) async {
    _isLoading = true;
    notifyListeners();

    try {
      _budgets = await _budgetService.getBudgetsByUser(userId);
    } catch (e) {
      debugPrint('Error loading budgets: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> addBudget(Budget budget) async {
    try {
      final id = await _budgetService.insertBudget(budget);
      if (id != null) {
        await loadBudgets(budget.userId);
        return true;
      }
      return false;
    } catch (e) {
      debugPrint('Error adding budget: $e');
      return false;
    }
  }

  Future<bool> updateBudget(Budget budget) async {
    try {
      await _budgetService.updateBudget(budget);
      await loadBudgets(budget.userId);
      return true;
    } catch (e) {
      debugPrint('Error updating budget: $e');
      return false;
    }
  }

  Future<bool> deleteBudget(int budgetId, int userId) async {
    try {
      await _budgetService.deleteBudget(budgetId);
      await loadBudgets(userId);
      return true;
    } catch (e) {
      debugPrint('Error deleting budget: $e');
      return false;
    }
  }
}

