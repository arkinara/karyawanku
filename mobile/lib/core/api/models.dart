// Auth contract models mirroring the BE's snake_case envelope
// (`backend/src/routes/auth.ts`, `backend/src/lib/auth.ts#publicUser`).
// Dart-side fields stay camelCase; every map is decoded explicitly.

enum UserRole { owner, manager, employee }

/// The safe user record returned by `publicUser` — never contains the
/// password hash.
class User {
  const User({
    required this.id,
    required this.businessId,
    required this.email,
    required this.nama,
    required this.role,
    this.employeeId,
    this.status = 'aktif',
    this.createdAt,
  });

  final String id;
  final String businessId;
  final String email;
  final String nama;
  final UserRole role;
  final String? employeeId;
  final String status;
  final DateTime? createdAt;

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      businessId: json['business_id'] as String,
      email: json['email'] as String,
      nama: json['nama'] as String,
      role: UserRole.values.firstWhere(
        (r) => r.name == json['role'],
        orElse: () => UserRole.employee,
      ),
      employeeId: json['employee_id'] as String?,
      status: (json['status'] as String?) ?? 'aktif',
      createdAt: switch (json['created_at']) {
        final String raw => DateTime.tryParse(raw),
        final int raw => DateTime.fromMillisecondsSinceEpoch(raw * 1000),
        _ => null,
      },
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'business_id': businessId,
    'email': email,
    'nama': nama,
    'role': role.name,
    'employee_id': employeeId,
    'status': status,
    if (createdAt != null)
      'created_at': createdAt!.toIso8601String(),
  };

  /// Monogram used by the avatar, e.g. `Siti Nurhaliza` → `SN`.
  String get initials {
    String first(String s) =>
        s.isEmpty ? '' : String.fromCharCode(s.runes.first).toUpperCase();
    final parts = nama.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    final list = parts.toList();
    if (list.isEmpty) return '?';
    if (list.length == 1) return first(list.first);
    return first(list.first) + first(list.last);
  }

  /// Display label for the BE role enum.
  String get roleLabel => switch (role) {
    UserRole.owner => 'Owner',
    UserRole.manager => 'Manager',
    UserRole.employee => 'Employee',
  };
}

/// A stored, verified sign-in: the token pair plus the signed-in user.
class Session {
  const Session({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
  });

  final String accessToken;
  final String refreshToken;
  final User user;
}

/// Response of `POST /auth/sign-in`.
class SignInResponse {
  const SignInResponse({required this.session});

  final Session session;

  factory SignInResponse.fromJson(Map<String, dynamic> json) {
    final user = User.fromJson(json['user'] as Map<String, dynamic>);
    return SignInResponse(
      session: Session(
        accessToken: json['token'] as String,
        refreshToken: json['refresh_token'] as String,
        user: user,
      ),
    );
  }
}

/// Response of `POST /auth/refresh`.
class RefreshResponse {
  const RefreshResponse({required this.accessToken, required this.refreshToken});

  final String accessToken;
  final String refreshToken;

  factory RefreshResponse.fromJson(Map<String, dynamic> json) {
    return RefreshResponse(
      accessToken: json['access_token'] as String,
      refreshToken: json['refresh_token'] as String,
    );
  }
}