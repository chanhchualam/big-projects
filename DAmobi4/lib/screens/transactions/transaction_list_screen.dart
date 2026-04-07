import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:smartbudget/providers/auth_provider.dart';
import 'package:smartbudget/providers/transaction_provider.dart';
import 'package:smartbudget/screens/transactions/add_transaction_screen.dart';
import 'package:intl/intl.dart';

class TransactionListScreen extends StatefulWidget {
  const TransactionListScreen({super.key});

  @override
  State<TransactionListScreen> createState() => _TransactionListScreenState();
}

class _TransactionListScreenState extends State<TransactionListScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final user = authProvider.currentUser;
      if (user != null) {
        Provider.of<TransactionProvider>(context, listen: false)
            .loadTransactions(user.id!);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final transactionProvider = Provider.of<TransactionProvider>(context);
    final user = authProvider.currentUser;

    if (user == null) {
      return const Scaffold(
        body: Center(child: Text('Vui lòng đăng nhập')),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Giao dịch'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const AddTransactionScreen(),
                ),
              );
            },
          ),
        ],
      ),
      body: transactionProvider.isLoading
          ? const Center(child: CircularProgressIndicator())
          : transactionProvider.transactions.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.receipt_long_outlined,
                        size: 80,
                        color: Colors.grey[400],
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Chưa có giao dịch nào',
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
                              builder: (_) => const AddTransactionScreen(),
                            ),
                          );
                        },
                        icon: const Icon(Icons.add),
                        label: const Text('Thêm giao dịch'),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () async {
                    await transactionProvider.loadTransactions(user.id!);
                  },
                  child: ListView.builder(
                    itemCount: transactionProvider.transactions.length,
                    padding: const EdgeInsets.all(8),
                    itemBuilder: (context, index) {
                      final transaction =
                          transactionProvider.transactions[index];
                      final date = DateTime.parse(transaction.date);

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
                          title: Text(
                            transaction.description ?? 'Không có mô tả',
                            style: const TextStyle(fontWeight: FontWeight.w500),
                          ),
                          subtitle: Text(
                            DateFormat('dd/MM/yyyy HH:mm').format(date),
                          ),
                          trailing: Text(
                            '${transaction.type == 'income' ? '+' : '-'}${NumberFormat.currency(symbol: '₫', decimalDigits: 0).format(transaction.amount)}',
                            style: TextStyle(
                              color: transaction.type == 'income'
                                  ? Colors.green
                                  : Colors.red,
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                            ),
                          ),
                          onTap: () {
                            // TODO: Navigate to transaction detail
                          },
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}

