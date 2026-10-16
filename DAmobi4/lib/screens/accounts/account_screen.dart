import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:smartbudget/providers/auth_provider.dart';
import 'package:smartbudget/providers/account_provider.dart';
import 'package:smartbudget/screens/accounts/add_account_screen.dart';
import 'package:intl/intl.dart';

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key});

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final user = authProvider.currentUser;
      if (user != null) {
        Provider.of<AccountProvider>(context, listen: false)
            .loadAccounts(user.id!);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final accountProvider = Provider.of<AccountProvider>(context);
    final user = authProvider.currentUser;

    if (user == null) {
      return const Scaffold(
        body: Center(child: Text('Vui lòng đăng nhập')),
      );
    }

    final totalBalance = accountProvider.getTotalBalance();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Ví & Tài khoản'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const AddAccountScreen(),
                ),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Tổng số dư
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primaryContainer,
            ),
            child: Column(
              children: [
                Text(
                  'Tổng số dư',
                  style: TextStyle(
                    color: Colors.grey[600],
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  NumberFormat.currency(
                    symbol: '₫',
                    decimalDigits: 0,
                  ).format(totalBalance),
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
              ],
            ),
          ),
          // Danh sách tài khoản
          Expanded(
            child: accountProvider.isLoading
                ? const Center(child: CircularProgressIndicator())
                : accountProvider.accounts.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.account_balance_outlined,
                              size: 80,
                              color: Colors.grey[400],
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'Chưa có tài khoản nào',
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
                                    builder: (_) => const AddAccountScreen(),
                                  ),
                                );
                              },
                              icon: const Icon(Icons.add),
                              label: const Text('Thêm tài khoản'),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: () async {
                          await accountProvider.loadAccounts(user.id!);
                        },
                        child: ListView.builder(
                          itemCount: accountProvider.accounts.length,
                          padding: const EdgeInsets.all(16),
                          itemBuilder: (context, index) {
                            final account = accountProvider.accounts[index];

                            return Card(
                              margin: const EdgeInsets.only(bottom: 12),
                              child: ListTile(
                                leading: CircleAvatar(
                                  backgroundColor: account.color != null
                                      ? Color(int.parse(account.color!))
                                      : Theme.of(context).colorScheme.primary,
                                  child: account.icon != null
                                      ? Text(account.icon!)
                                      : Icon(
                                          _getAccountIcon(account.type),
                                          color: Colors.white,
                                        ),
                                ),
                                title: Text(
                                  account.name,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                subtitle: Text(_getAccountTypeLabel(account.type)),
                                trailing: Text(
                                  NumberFormat.currency(
                                    symbol: '₫',
                                    decimalDigits: 0,
                                  ).format(account.balance),
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  IconData _getAccountIcon(String type) {
    switch (type) {
      case 'cash':
        return Icons.money;
      case 'bank':
        return Icons.account_balance;
      case 'credit_card':
        return Icons.credit_card;
      case 'savings':
        return Icons.savings;
      default:
        return Icons.account_balance_wallet;
    }
  }

  String _getAccountTypeLabel(String type) {
    switch (type) {
      case 'cash':
        return 'Tiền mặt';
      case 'bank':
        return 'Ngân hàng';
      case 'credit_card':
        return 'Thẻ tín dụng';
      case 'savings':
        return 'Tiết kiệm';
      default:
        return type;
    }
  }
}

