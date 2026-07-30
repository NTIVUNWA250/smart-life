# API Reference (v1)

Base URL: `http://localhost:4000/api/v1` (HTTPS in production).
All authenticated routes require `Authorization: Bearer <accessToken>`.
All money values are integer **RWF**.

> This is the planned surface; endpoints are added as modules are implemented.

## Auth
| Method | Path             | Body                          | Description                |
| ------ | ---------------- | ----------------------------- | -------------------------- |
| POST   | `/auth/signup`   | name, email, password, role   | Create account             |
| POST   | `/auth/login`    | email, password               | Returns access + refresh   |
| POST   | `/auth/refresh`  | refreshToken                  | New access token           |
| POST   | `/auth/logout`   | -                             | Invalidate refresh token   |

## Transactions
| Method | Path                  | Description                    |
| ------ | --------------------- | ------------------------------ |
| GET    | `/transactions`       | List (filter by type/date)     |
| POST   | `/transactions`       | Add income/expense             |

> There is no delete endpoint, by design. Recorded spending drives the limit, and
> passing the limit blocks payments until a peer or parent approves (FR4/FR6).
> Deleting an expense would recompute the limit downward and lift that block with
> no approval and no audit trail, making the approval system optional for anyone
> willing to remove a row.

## Goals
| Method | Path           | Description                        |
| ------ | -------------- | ---------------------------------- |
| GET    | `/goals`       | List goals + progress              |
| POST   | `/goals`       | Create goal (target, deadline)     |
| PATCH  | `/goals/:id`   | Update / record progress           |

## Limits & payment blocking
| Method | Path                    | Description                              |
| ------ | ----------------------- | ---------------------------------------- |
| GET    | `/limits/current`       | Current period limit, spent, blocked?    |
| POST   | `/limits/check`         | Check a proposed payment vs. limit       |
| POST   | `/limits/block`         | Block payments (provider adapter)        |
| POST   | `/limits/unblock`       | Unblock (requires approved override)     |

## Screen time
| Method | Path                      | Description                       |
| ------ | ------------------------- | --------------------------------- |
| GET    | `/screentime/policies`    | List app/site limits              |
| POST   | `/screentime/policies`    | Create/update a daily limit       |
| POST   | `/screentime/usage`       | Mobile reports usage (sync)       |

## Approvals
| Method | Path                      | Description                          |
| ------ | ------------------------- | ------------------------------------ |
| POST   | `/approvals`              | Request a peer/parental override     |
| GET    | `/approvals?role=approver`| Pending requests for an approver     |
| PATCH  | `/approvals/:id`          | Approve / deny                       |

## Analytics
| Method | Path                  | Description                          |
| ------ | --------------------- | ------------------------------------ |
| GET    | `/analytics/summary`  | Savings, spend vs. limit, time usage |

## Admin
| Method | Path             | Description                |
| ------ | ---------------- | -------------------------- |
| GET    | `/admin/users`   | List/manage users          |
| PATCH  | `/admin/users/:id`| Update role / status      |
