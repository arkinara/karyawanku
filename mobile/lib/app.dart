import 'package:flutter/material.dart';

import 'features/auth/masuk_screen.dart';
import 'theme/app_theme.dart';

class KaryawanKuApp extends StatelessWidget {
  const KaryawanKuApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'KaryawanKu',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      darkTheme: buildAppTheme(brightness: Brightness.dark),
      themeMode: ThemeMode.system,
      home: const MasukScreen(),
    );
  }
}
