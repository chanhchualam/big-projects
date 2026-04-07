import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:smartbudget/providers/auth_provider.dart';
import 'package:smartbudget/providers/budget_provider.dart';
import 'package:smartbudget/screens/budgets/add_budget_screen.dart';
import 'package:intl/intl.dart';

class BudgetScreen extends StatefulWidget {
  const BudgetScreen({super.key});

  @override
  State<BudgetScreen> createState() => _BudgetScreenState();
}

class _BudgetScreenState extends State<BudgetScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final user = authProvider.currentUser;
      if (user != null) {
        Provider.of<BudgetProvider>(context, listen: false)
            .loadBudgets(user.id!);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final budgetProvider = Provider.of<BudgetProvider>(context);
    final user = authProvider.currentUser;

    if (user == null) {
      return const Scaffold(
        body: Center(child: Text('Vui lòng đăng nhập')),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Ngân sách'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const AddBudgetScreen(),
                ),
              );
            },
          ),
        ],
      ),
      body: budgetProvider.isLoading
          ? const Center(child: CircularProgressIndicator())
          : budgetProvider.budgets.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.account_balance_wallet_outlined,
                        size: 80,
                        color: Colors.grey[400],
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Chưa có ngân sách nào',
                        style: TextStyle(
                          fontSize: 18,
                          color: Colors.grey[600],
                        ),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton.icon(
                        onPressed: () {
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const AddBudgetScreen(),
                            ),
                          );
                        },
                        icon: const Icon(Icons.add),
                        label: const Text('Thêm ngân sách'),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () async {
                    await budgetProvider.loadBudgets(user.id!);
                  },
                  child: ListView.builder(
                    itemCount: budgetProvider.budgets.length,
                    padding: const EdgeInsets.all(16),
                    itemBuilder: (context, index) {
                      final budget = budgetProvider.budgets[index];
                      final startDate = DateTime.parse(budget.startDate);

                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    _getPeriodLabel(budget.period),
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  Text(
                                    NumberFormat.currency(
                                      symbol: '₫',
                                      decimalDigits: 0,
                                    ).format(budget.amount),
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.bold,
                                      color:
                                          Theme.of(context).colorScheme.primary,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Bắt đầu: ${DateFormat('dd/MM/yyyy').format(startDate)}',
                                style: TextStyle(
                                  color: Colors.grey[600],
                                  fontSize: 14,
                                ),
                              ),
                              if (budget.endDate != null) ...[
                                const SizedBox(height: 4),
                                Text(
                                  'Kết thúc: ${DateFormat('dd/MM/yyyy').format(DateTime.parse(budget.endDate!))}',
                                  style: TextStyle(
                                    color: Colors.grey[600],
                                    fontSize: 14,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }

  String _getPeriodLabel(String period) {
    switch (period) {
      case 'daily':
        return 'Hàng ngày';
      case 'weekly':
        return 'Hàng tuần';
      case 'monthly':
        return 'Hàng tháng';
      case 'yearly':
        return 'Hàng năm';
      default:
        return period;
    }
  }
}

