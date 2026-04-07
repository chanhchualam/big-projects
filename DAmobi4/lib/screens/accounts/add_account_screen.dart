import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:smartbudget/providers/auth_provider.dart';
import 'package:smartbudget/providers/account_provider.dart';
import 'package:smartbudget/models/account_model.dart';

class AddAccountScreen extends StatefulWidget {
  const AddAccountScreen({super.key});

  @override
  State<AddAccountScreen> createState() => _AddAccountScreenState();
}

class _AddAccountScreenState extends State<AddAccountScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _balanceController = TextEditingController();
  String _selectedType = 'cash';
  bool _isLoading = false;

  @override
  void dispose() {
    _nameController.dispose();
    _balanceController.dispose();
    super.dispose();
  }

  Future<void> _saveAccount() async {
    if (!_formKey.currentState!.validate()) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final accountProvider = Provider.of<AccountProvider>(context, listen: false);

    final user = authProvider.currentUser;
    if (user == null) return;

    setState(() => _isLoading = true);

    final account = Account(
      userId: user.id!,
      name: _nameController.text.trim(),
      type: _selectedType,
      balance: _balanceController.text.isNotEmpty
          ? double.parse(_balanceController.text)
          : 0,
      currency: 'VND',
      createdAt: DateTime.now().toIso8601String(),
    );

    final success = await accountProvider.addAccount(account);

    setState(() => _isLoading = false);

    if (!mounted) return;

    if (success) {
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Thêm tài khoản thành công'),
          backgroundColor: Colors.green,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Thêm tài khoản thất bại'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Thêm tài khoản'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Tên tài khoản
              TextFormField(
                controller: _nameController,
                decoration: InputDecoration(
                  labelText: 'Tên tài khoản',
                  prefixIcon: const Icon(Icons.account_balance_wallet),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Vui lòng nhập tên tài khoản';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              // Loại tài khoản
              Text(
                'Loại tài khoản',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'cash', label: Text('Tiền mặt')),
                  ButtonSegment(value: 'bank', label: Text('Ngân hàng')),
                  ButtonSegment(
                      value: 'credit_card', label: Text('Thẻ tín dụng')),
                  ButtonSegment(value: 'savings', label: Text('Tiết kiệm')),
                ],
                selected: {_selectedType},
                onSelectionChanged: (Set<String> newSelection) {
                  setState(() => _selectedType = newSelection.first);
                },
              ),
              const SizedBox(height: 16),
              // Số dư ban đầu
              TextFormField(
                controller: _balanceController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'Số dư ban đầu (tùy chọn)',
                  prefixIcon: const Icon(Icons.attach_money),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                validator: (value) {
                  if (value != null &&
                      value.isNotEmpty &&
                      double.tryParse(value) == null) {
                    return 'Số dư không hợp lệ';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: _isLoading ? null : _saveAccount,
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
                    : const Text('Lưu tài khoản'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

