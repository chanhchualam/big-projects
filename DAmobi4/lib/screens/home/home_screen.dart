import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:smartbudget/providers/auth_provider.dart';
import 'package:smartbudget/providers/transaction_provider.dart';
import 'package:smartbudget/providers/account_provider.dart';
import 'package:smartbudget/screens/transactions/transaction_list_screen.dart';
import 'package:smartbudget/screens/transactions/add_transaction_screen.dart';
import 'package:smartbudget/screens/budgets/budget_screen.dart';
import 'package:smartbudget/screens/accounts/account_screen.dart';
import 'package:smartbudget/screens/reports/report_screen.dart';
import 'package:smartbudget/screens/auth/login_screen.dart';
import 'package:intl/intl.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  final List<Widget> _screens = [
    const HomeTab(),
    const TransactionListScreen(),
    const BudgetScreen(),
    const AccountScreen(),
    const ReportScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_currentIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() => _currentIndex = index);
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Trang chủ',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: 'Giao dịch',
          ),
          NavigationDestination(
            icon: Icon(Icons.account_balance_wallet_outlined),
            selectedIcon: Icon(Icons.account_balance_wallet),
            label: 'Ngân sách',
          ),
          NavigationDestination(
            icon: Icon(Icons.account_balance_outlined),
            selectedIcon: Icon(Icons.account_balance),
            label: 'Ví',
          ),
          NavigationDestination(
            icon: Icon(Icons.bar_chart_outlined),
            selectedIcon: Icon(Icons.bar_chart),
            label: 'Báo cáo',
          ),
        ],
      ),
      floatingActionButton: _currentIndex == 1
          ? FloatingActionButton(
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const AddTransactionScreen(),
                  ),
                );
              },
              child: const Icon(Icons.add),
            )
          : null,
    );
  }
}

class HomeTab extends StatelessWidget {
  const HomeTab({super.key});

  static void switchToTransactions(BuildContext context) {
    final homeState = context.findAncestorStateOfType<_HomeScreenState>();
    if (homeState != null) {
      homeState.switchToTab(1);
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final transactionProvider = Provider.of<TransactionProvider>(context);
    final accountProvider = Provider.of<AccountProvider>(context);

    final user = authProvider.currentUser;
    if (user == null) {
      return const Center(child: Text('Vui lòng đăng nhập'));
    }

    // Load data
    WidgetsBinding.instance.addPostFrameCallback((_) {
      transactionProvider.loadTransactions(user.id!);
      accountProvider.loadAccounts(user.id!);
    });

    final totalIncome = transactionProvider.getTotalIncome(user.id!);
    final totalExpense = transactionProvider.getTotalExpense(user.id!);
    final balance = totalIncome - totalExpense;
    final totalAccountBalance = accountProvider.getTotalBalance();

    return Scaffold(
      appBar: AppBar(
        title: Text('Xin chào, ${user.fullName ?? user.username}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await authProvider.logout();
              if (context.mounted) {
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                );
              }
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await Future.wait([
            transactionProvider.loadTransactions(user.id!),
            accountProvider.loadAccounts(user.id!),
          ]);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Tổng quan tài chính
              Card(
                elevation: 2,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Tổng số dư',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              color: Colors.grey[600],
                            ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        NumberFormat.currency(
                          symbol: '₫',
                          decimalDigits: 0,
                        ).format(totalAccountBalance),
                        style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: Theme.of(context).colorScheme.primary,
                            ),
                      ),
                      const SizedBox(height: 20),
                      Row(
                        children: [
                          Expanded(
                            child: _buildStatCard(
                              context,
                              'Thu nhập',
                              totalIncome,
                              Colors.green,
                              Icons.arrow_upward,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _buildStatCard(
                              context,
                              'Chi tiêu',
                              totalExpense,
                              Colors.red,
                              Icons.arrow_downward,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
              // Giao dịch gần đây
              Text(
                'Giao dịch gần đây',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 12),
              if (transactionProvider.transactions.isEmpty)
                const Card(
                  child: Padding(
                    padding: EdgeInsets.all(40),
                    child: Center(
                      child: Text('Chưa có giao dịch nào'),
                    ),
                  ),
                )
              else
                ...transactionProvider.transactions.take(5).map((transaction) {
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: transaction.type == 'income'
                            ? Colors.green.withOpacity(0.2)
                            : Colors.red.withOpacity(0.2),
                        child: Icon(
                          transaction.type == 'income'
                              ? Icons.arrow_upward
                              : Icons.arrow_downward,
                          color: transaction.type == 'income'
                              ? Colors.green
                              : Colors.red,
                        ),
                      ),
                      title: Text(transaction.description ?? 'Không có mô tả'),
                      subtitle: Text(
                        DateFormat('dd/MM/yyyy').format(
                          DateTime.parse(transaction.date),
                        ),
                      ),
                      trailing: Text(
                        '${transaction.type == 'income' ? '+' : '-'}${NumberFormat.currency(symbol: '₫', decimalDigits: 0).format(transaction.amount)}',
                        style: TextStyle(
                          color: transaction.type == 'income'
                              ? Colors.green
                              : Colors.red,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  );
                }),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () {
                  HomeTab.switchToTransactions(context);
                },
                child: const Text('Xem tất cả giao dịch'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatCard(
    BuildContext context,
    String label,
    double amount,
    Color color,
    IconData icon,
  ) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 20),
              const SizedBox(width: 4),
              Text(
                label,
                style: TextStyle(
                  color: Colors.grey[600],
                  fontSize: 12,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            NumberFormat.currency(symbol: '₫', decimalDigits: 0).format(amount),
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.bold,
              fontSize: 16,
            ),
          ),
        ],
      ),
    );
  }
}

