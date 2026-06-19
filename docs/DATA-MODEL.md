# Data Model

PostgreSQL via Prisma. All money fields are integer **RWF** (no fractional francs).
This is the initial v1.0 schema; it will be refined as features land.

## Entities

### User
| Field          | Type      | Notes                                  |
| -------------- | --------- | -------------------------------------- |
| id             | uuid PK   |                                        |
| name           | text      |                                        |
| email          | text uniq |                                        |
| passwordHash   | text      | bcrypt                                 |
| role           | enum      | `student` \| `approver` \| `admin`     |
| isMinor        | bool      | drives parental-control rules          |
| createdAt      | timestamp |                                        |

### Transaction (income / expense)
| Field      | Type      | Notes                          |
| ---------- | --------- | ------------------------------ |
| id         | uuid PK   |                                |
| userId     | uuid FK   | → User                         |
| type       | enum      | `income` \| `expense`          |
| amountRwf  | int       |                                |
| category   | text      |                                |
| note       | text      |                                |
| occurredAt | timestamp |                                |

### Goal
| Field        | Type      | Notes                               |
| ------------ | --------- | ----------------------------------- |
| id           | uuid PK   |                                     |
| userId       | uuid FK   |                                     |
| title        | text      |                                     |
| targetRwf    | int       |                                     |
| savedRwf     | int       | running progress                    |
| deadline     | date      |                                     |
| status       | enum      | `active` \| `achieved` \| `failed`  |

### SpendingLimit
| Field        | Type      | Notes                                  |
| ------------ | --------- | -------------------------------------- |
| id           | uuid PK   |                                        |
| userId       | uuid FK   |                                        |
| periodStart  | date      |                                        |
| limitRwf     | int       | computed from income & goals           |
| spentRwf     | int       |                                        |
| isBlocked    | bool      | payments currently blocked             |

### ScreenTimePolicy
| Field        | Type      | Notes                                  |
| ------------ | --------- | -------------------------------------- |
| id           | uuid PK   |                                        |
| userId       | uuid FK   |                                        |
| appOrSite    | text      | identifier                             |
| dailyLimitMin| int       | minutes per day                        |
| usedMin      | int       |                                        |
| isBlocked    | bool      |                                        |

### Approval (peer / parental override)
| Field        | Type      | Notes                                          |
| ------------ | --------- | ---------------------------------------------- |
| id           | uuid PK   |                                                |
| requesterId  | uuid FK   | → User (student)                               |
| approverId   | uuid FK   | → User (peer/parent)                           |
| kind         | enum      | `spending` \| `screentime`                     |
| targetId     | uuid      | the limit/policy being unlocked                |
| status       | enum      | `pending` \| `approved` \| `denied`            |
| createdAt    | timestamp |                                                |

### PeerLink
Connects a student to their approvers (friends/family), with `relationship`
(`peer` \| `parent`) and acceptance status.

## Relationships

- User 1—* Transaction, Goal, SpendingLimit, ScreenTimePolicy
- User *—* User via PeerLink (student ↔ approver)
- Approval references one requester + one approver
