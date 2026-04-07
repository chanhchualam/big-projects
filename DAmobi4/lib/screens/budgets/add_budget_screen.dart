import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:smartbudget/providers/auth_provider.dart';
import 'package:smartbudget/providers/budget_provider.dart';
import 'package:smartbudget/models/budget_model.dart';
import 'package:intl/intl.dart';

class AddBudgetScreen extends StatefulWidget {
  const AddBudgetScreen({super.key});

  @override
  State<AddBudgetScreen> createState() => _AddBudgetScreenState();
}

class _AddBudgetScreenState extends State<AddBudgetScreen> {
  final _formKey = GlobalKey<FormState>();
  final _amountController = TextEditingController();
  String _selectedPeriod = 'monthly';
  DateTime _selectedStartDate = DateTime.now();
  DateTime? _selectedEndDate;
  bool _isLoading = false;

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _selectStartDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedStartDate,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (picked != null) {
      setState(() => _selectedStartDate = picked);
    }
  }

  Future<void> _selectEndDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedEndDate ?? _selectedStartDate,
      firstDate: _selectedStartDate,
      lastDate: DateTime(2100),
    );
    if (picked != null) {
      setState(() => _selectedEndDate = picked);
    }
  }

  Future<void> _saveBudget() async {
    if (!_formKey.currentState!.validate()) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final budgetProvider = Provider.of<BudgetProvider>(context, listen: false);

    final user = authProvider.currentUser;
    if (user == null) return;

    setState(() => _isLoading = true);

    final budget = Budget(
      userId: user.id!,
      amount: double.parse(_amountController.text),
      period: _selectedPeriod,
      startDate: _selectedStartDate.toIso8601String(),
      endDate: _selectedEndDate?.toIso8601String(),
      createdAt: DateTime.now().toIso8601String(),
    );

    final success = await budgetProvider.addBudget(budget);

    setState(() => _isLoading = false);

    if (!mounted) return;

    if (success) {
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Thêm ngân sách thành công'),
          backgroundColor: Colors.green,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Thêm ngân sách thất bại'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Thêm ngân sách'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Chu kỳ
              Text(
                'Chu kỳ',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'daily', label: Text('Hàng ngày')),
                  ButtonSegment(value: 'weekly', label: Text('Hàng tuần')),
                  ButtonSegment(value: 'monthly', label: Text('Hàng tháng')),
                  ButtonSegment(value: 'yearly', label: Text('Hàng năm')),
                ],
                selected: {_selectedPeriod},
                onSelectionChanged: (Set<String> newSelection) {
                  setState(() => _selectedPeriod = newSelection.first);
                },
              ),
              const SizedBox(height: 24),
              // Số tiền
              TextFormField(
                controller: _amountController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'Số tiền',
                  prefixIcon: const Icon(Icons.attach_money),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Vui lòng nhập số tiền';
                  }
                  if (double.tryParse(value) == null) {
                    return 'Số tiền không hợp lệ';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              // Ngày bắt đầu
              InkWell(
                onTap: _selectStartDate,
                child: InputDecorator(
                  decoration: InputDecoration(
                    labelText: 'Ngày bắt đầu',
                    prefixIcon: const Icon(Icons.calendar_today),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(
                    DateFormat('dd/MM/yyyy').format(_selectedStartDate),
                    style: const TextStyle(fontSize: 16),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              // Ngày kết thúc (tùy chọn)
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: _selectEndDate,
                      child: InputDecorator(
                        decoration: InputDecoration(
                          labelText: 'Ngày kết thúc (tùy chọn)',
                          prefixIcon: const Icon(Icons.event),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: Text(
                          _selectedEndDate != null
                              ? DateFormat('dd/MM/yyyy').format(_selectedEndDate!)
                              : 'Chưa chọn',
                          style: TextStyle(
                            fontSize: 16,
                            color: _selectedEndDate != null
                                ? null
                                : Colors.grey,
                          ),
                        ),
                      ),
                    ),
                  ),
                  if (_selectedEndDate != null)
                    IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: () {
                        setState(() => _selectedEndDate = null);
                      },
                    ),
                ],
              ),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: _isLoading ? null : _saveBudget,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Lưu ngân sách'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

