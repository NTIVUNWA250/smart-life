// Typed models mirroring the SMART LIFE backend response shapes.
//
// All money fields are integer RWF. Parsing is defensive: numbers may arrive
// as `int` or `num`, so we coerce through `_int`.

int _int(Object? v) => (v as num?)?.toInt() ?? 0;

DateTime _date(Object? v) =>
    v == null ? DateTime.now() : DateTime.parse(v as String);

class User {
  User({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.isMinor,
  });

  final String id;
  final String name;
  final String email;
  final String role; // student | approver | admin
  final bool isMinor;

  factory User.fromJson(Map<String, dynamic> j) => User(
        id: j['id'] as String,
        name: j['name'] as String,
        email: j['email'] as String,
        role: j['role'] as String,
        isMinor: j['isMinor'] as bool? ?? false,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'email': email,
        'role': role,
        'isMinor': isMinor,
      };
}

class AuthResult {
  AuthResult({required this.user, required this.accessToken, required this.refreshToken});

  final User user;
  final String accessToken;
  final String refreshToken;

  factory AuthResult.fromJson(Map<String, dynamic> j) {
    final tokens = j['tokens'] as Map<String, dynamic>;
    return AuthResult(
      user: User.fromJson(j['user'] as Map<String, dynamic>),
      accessToken: tokens['accessToken'] as String,
      refreshToken: tokens['refreshToken'] as String,
    );
  }
}

class Transaction {
  Transaction({
    required this.id,
    required this.type,
    required this.amountRwf,
    required this.category,
    required this.note,
    required this.occurredAt,
  });

  final String id;
  final String type; // income | expense
  final int amountRwf;
  final String category;
  final String? note;
  final DateTime occurredAt;

  bool get isIncome => type == 'income';

  factory Transaction.fromJson(Map<String, dynamic> j) => Transaction(
        id: j['id'] as String,
        type: j['type'] as String,
        amountRwf: _int(j['amountRwf']),
        category: j['category'] as String? ?? 'general',
        note: j['note'] as String?,
        occurredAt: _date(j['occurredAt']),
      );
}

class Goal {
  Goal({
    required this.id,
    required this.title,
    required this.targetRwf,
    required this.savedRwf,
    required this.deadline,
    required this.status,
  });

  final String id;
  final String title;
  final int targetRwf;
  final int savedRwf;
  final DateTime deadline;
  final String status; // active | achieved | failed

  double get progress =>
      targetRwf <= 0 ? 0 : (savedRwf / targetRwf).clamp(0.0, 1.0);

  factory Goal.fromJson(Map<String, dynamic> j) => Goal(
        id: j['id'] as String,
        title: j['title'] as String,
        targetRwf: _int(j['targetRwf']),
        savedRwf: _int(j['savedRwf']),
        deadline: _date(j['deadline']),
        status: j['status'] as String? ?? 'active',
      );
}

class SpendingLimit {
  SpendingLimit({
    required this.limitRwf,
    required this.spentRwf,
    required this.isBlocked,
    required this.periodStart,
    required this.periodEnd,
  });

  final int limitRwf;
  final int spentRwf;
  final bool isBlocked;
  final DateTime periodStart;
  final DateTime periodEnd;

  int get remainingRwf => (limitRwf - spentRwf).clamp(0, limitRwf);
  double get usage => limitRwf <= 0 ? 1 : (spentRwf / limitRwf).clamp(0.0, 1.0);

  factory SpendingLimit.fromJson(Map<String, dynamic> j) => SpendingLimit(
        limitRwf: _int(j['limitRwf']),
        spentRwf: _int(j['spentRwf']),
        isBlocked: j['isBlocked'] as bool? ?? false,
        periodStart: _date(j['periodStart']),
        periodEnd: _date(j['periodEnd']),
      );
}

class PaymentCheck {
  PaymentCheck({required this.allowed, required this.reason, required this.limit});

  final bool allowed;
  final String? reason;
  final SpendingLimit limit;

  factory PaymentCheck.fromJson(Map<String, dynamic> j) => PaymentCheck(
        allowed: j['allowed'] as bool? ?? false,
        reason: j['reason'] as String?,
        limit: SpendingLimit.fromJson(j['limit'] as Map<String, dynamic>),
      );
}

class ScreenTimePolicy {
  ScreenTimePolicy({
    required this.id,
    required this.appOrSite,
    required this.kind,
    this.label,
    required this.dailyLimitMin,
    required this.usedMin,
    required this.isBlocked,
  });

  final String id;
  final String appOrSite;
  final String kind; // 'app' | 'url'
  final String? label;
  final int dailyLimitMin;
  final int usedMin;
  final bool isBlocked;

  /// Friendly name for display (label, falling back to the raw identifier).
  String get displayName => (label != null && label!.isNotEmpty) ? label! : appOrSite;
  bool get isApp => kind == 'app';

  double get usage =>
      dailyLimitMin <= 0 ? 0 : (usedMin / dailyLimitMin).clamp(0.0, 1.0);

  factory ScreenTimePolicy.fromJson(Map<String, dynamic> j) => ScreenTimePolicy(
        id: j['id'] as String,
        appOrSite: j['appOrSite'] as String,
        kind: j['kind'] as String? ?? 'url',
        label: j['label'] as String?,
        dailyLimitMin: _int(j['dailyLimitMin']),
        usedMin: _int(j['usedMin']),
        isBlocked: j['isBlocked'] as bool? ?? false,
      );
}

/// A linked person (from `/peers`) — used as the approver options when a
/// student requests an override.
class PeerPerson {
  PeerPerson({required this.id, required this.name, required this.email});

  final String id;
  final String name;
  final String email;

  factory PeerPerson.fromJson(Map<String, dynamic> j) => PeerPerson(
        id: j['id'] as String,
        name: j['name'] as String? ?? j['email'] as String,
        email: j['email'] as String,
      );
}

class Approval {
  Approval({
    required this.id,
    required this.kind,
    required this.targetId,
    required this.status,
    required this.reason,
    required this.createdAt,
    required this.requester,
    required this.approver,
  });

  final String id;
  final String kind; // spending | screentime
  final String targetId;
  final String status; // pending | approved | denied
  final String? reason;
  final DateTime createdAt;
  final PeerPerson? requester;
  final PeerPerson? approver;

  factory Approval.fromJson(Map<String, dynamic> j) => Approval(
        id: j['id'] as String,
        kind: j['kind'] as String,
        targetId: j['targetId'] as String? ?? '',
        status: j['status'] as String? ?? 'pending',
        reason: j['reason'] as String?,
        createdAt: _date(j['createdAt']),
        requester: j['requester'] == null
            ? null
            : PeerPerson.fromJson(j['requester'] as Map<String, dynamic>),
        approver: j['approver'] == null
            ? null
            : PeerPerson.fromJson(j['approver'] as Map<String, dynamic>),
      );
}

/// A peer/parent link from `/peers`. `approver` is set on links where the
/// current user is the student; `student` is set on links where the current
/// user is the approver.
class PeerLink {
  PeerLink({
    required this.id,
    required this.relationship,
    required this.status,
    required this.approver,
    required this.student,
  });

  final String id;
  final String relationship; // peer | parent
  final String status; // pending | accepted | rejected
  final PeerPerson? approver;
  final PeerPerson? student;

  factory PeerLink.fromJson(Map<String, dynamic> j) => PeerLink(
        id: j['id'] as String,
        relationship: j['relationship'] as String? ?? 'peer',
        status: j['status'] as String? ?? 'pending',
        approver: j['approver'] == null
            ? null
            : PeerPerson.fromJson(j['approver'] as Map<String, dynamic>),
        student: j['student'] == null
            ? null
            : PeerPerson.fromJson(j['student'] as Map<String, dynamic>),
      );
}

class PeerLinks {
  PeerLinks({required this.asStudent, required this.asApprover});

  final List<PeerLink> asStudent;
  final List<PeerLink> asApprover;

  factory PeerLinks.fromJson(Map<String, dynamic> j) => PeerLinks(
        asStudent: ((j['asStudent'] as List?) ?? [])
            .map((e) => PeerLink.fromJson(e as Map<String, dynamic>))
            .toList(),
        asApprover: ((j['asApprover'] as List?) ?? [])
            .map((e) => PeerLink.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

/// `/analytics/summary` response.
class AnalyticsSummary {
  AnalyticsSummary({
    required this.incomeRwf,
    required this.expenseRwf,
    required this.limitRwf,
    required this.spentRwf,
    required this.isBlocked,
    required this.savedRwf,
    required this.targetRwf,
    required this.progressPct,
    required this.activeGoals,
    required this.achievedGoals,
    required this.totalUsedMin,
    required this.totalLimitMin,
    required this.blockedApps,
  });

  // finance
  final int incomeRwf;
  final int expenseRwf;
  final int limitRwf;
  final int spentRwf;
  final bool isBlocked;
  // savings
  final int savedRwf;
  final int targetRwf;
  final int progressPct;
  final int activeGoals;
  final int achievedGoals;
  // time
  final int totalUsedMin;
  final int totalLimitMin;
  final List<String> blockedApps;

  factory AnalyticsSummary.fromJson(Map<String, dynamic> j) {
    final finance = (j['finance'] ?? {}) as Map<String, dynamic>;
    final savings = (j['savings'] ?? {}) as Map<String, dynamic>;
    final time = (j['time'] ?? {}) as Map<String, dynamic>;
    return AnalyticsSummary(
      incomeRwf: _int(finance['incomeRwf']),
      expenseRwf: _int(finance['expenseRwf']),
      limitRwf: _int(finance['limitRwf']),
      spentRwf: _int(finance['spentRwf']),
      isBlocked: finance['isBlocked'] as bool? ?? false,
      savedRwf: _int(savings['savedRwf']),
      targetRwf: _int(savings['targetRwf']),
      progressPct: _int(savings['progressPct']),
      activeGoals: _int(savings['activeGoals']),
      achievedGoals: _int(savings['achievedGoals']),
      totalUsedMin: _int(time['totalUsedMin']),
      totalLimitMin: _int(time['totalLimitMin']),
      blockedApps:
          (time['blocked'] as List?)?.map((e) => e.toString()).toList() ?? [],
    );
  }
}
