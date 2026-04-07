import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:smartbudget/providers/auth_provider.dart';
import 'package:smartbudget/providers/transaction_provider.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';

class ReportScreen extends StatefulWidget {
  const ReportScreen({super.key});

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  String _selectedPeriod = 'month';

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

    final totalIncome = transactionProvider.getTotalIncome(user.id!);
    final totalExpense = transactionProvider.getTotalExpense(user.id!);
    final balance = totalIncome - totalExpense;

    // Tính toán dữ liệu cho biểu đồ
    final expenseTransactions = transactionProvider.transactions
        .where((t) => t.userId == user.id! && t.type == 'expense')
        .toList();

    // Nhóm theo tháng
    final Map<String, double> monthlyExpenses = {};
    for (var transaction in expenseTransactions) {
      final date = DateTime.parse(transaction.date);
      final monthKey = '${date.year}-${date.month.toString().padLeft(2, '0')}';
      monthlyExpenses[monthKey] =
          (monthlyExpenses[monthKey] ?? 0) + transaction.amount;
    }

    final chartData = monthlyExpenses.entries.toList()
      ..sort((a, b) => a.key.compareTo(b.key));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Báo cáo'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Tổng quan
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _buildStatItem(
                          context,
                          'Thu nhập',
                          totalIncome,
                          Colors.green,
                          Icons.arrow_upward,
                        ),
                        _buildStatItem(
                          context,
                          'Chi tiêu',
                          totalExpense,
                          Colors.red,
                          Icons.arrow_downward,
                        ),
                        _buildStatItem(
                          context,
                          'Còn lại',
                          balance,
                          balance >= 0 ? Colors.blue : Colors.orange,
                          Icons.account_balance_wallet,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            // Biểu đồ chi tiêu theo tháng
            Text(
              'Chi tiêu theo tháng',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            const SizedBox(height: 16),
            if (chartData.isEmpty)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(40),
                  child: Center(
                    child: Text('Chưa có dữ liệu để hiển thị'),
                  ),
                ),
              )
            else
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: SizedBox(
                    height: 300,
                    child: BarChart(
                      BarChartData(
                        alignment: BarChartAlignment.spaceAround,
                        maxY: chartData.map((e) => e.value).reduce((a, b) => a > b ? a : b) * 1.2,
                        barTouchData: BarTouchData(
                          enabled: true,
                          touchTooltipData: BarTouchTooltipData(
                            getTooltipColor: (group) => Colors.grey[800]!,
                            tooltipRoundedRadius: 8,
                          ),
                        ),
                        titlesData: FlTitlesData(
                          show: true,
                          bottomTitles: AxisTitles(
                            sideTitles: SideTitles(
                              showTitles: true,
                              getTitlesWidget: (value, meta) {
                                if (value.toInt() >= 0 &&
                                    value.toInt() < chartData.length) {
                                  final key = chartData[value.toInt()].key;
                                  final parts = key.split('-');
                                  return Text('${parts[1]}/${parts[0]}');
                                }
                                return const Text('');
                              },
                            ),
                          ),
                          leftTitles: AxisTitles(
                            sideTitles: SideTitles(
                              showTitles: true,
                              getTitlesWidget: (value, meta) {
                                return Text(
                                  NumberFormat.compactCurrency(
                                    symbol: '₫',
                                    decimalDigits: 0,
                                  ).format(value),
                                  style: const TextStyle(fontSize: 10),
                                );
                              },
                            ),
                          ),
                          topTitles: const AxisTitles(
                            sideTitles: SideTitles(showTitles: false),
                          ),
                          rightTitles: const AxisTitles(
                            sideTitles: SideTitles(showTitles: false),
                          ),
                        ),
                        borderData: FlBorderData(show: false),
                        barGroups: chartData.asMap().entries.map((entry) {
                          final index = entry.key;
                          final data = entry.value;
                          return BarChartGroupData(
                            x: index,
                            barRods: [
                              BarChartRodData(
                                toY: data.value,
                                color: Colors.red,
                                width: 20,
                                borderRadius: const BorderRadius.vertical(
                                  top: Radius.circular(4),
                                ),
                              ),
                            ],
                          );
                        }).toList(),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatItem(
    BuildContext context,
    String label,
    double value,
    Color color,
    IconData icon,
  ) {
    return Column(
      children: [
        Icon(icon, color: color, size: 32),
        const SizedBox(height: 8),
        Text(
          label,
          style: TextStyle(
            color: Colors.grey[600],
            fontSize: 12,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          NumberFormat.currency(
            symbol: '₫',
            decimalDigits: 0,
          ).format(value),
          style: TextStyle(
            color: color,
            fontWeight: FontWeight.bold,
            fontSize: 14,
          ),
        ),
      ],
    );
  }
}

