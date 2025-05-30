use hypr_db_core::SqlTable;

use super::{AdminDatabase, Integration};

impl AdminDatabase {
    pub async fn list_integrations(
        &self,
        user_id: impl AsRef<str>,
    ) -> Result<Vec<Integration>, crate::Error> {
        let conn = self.conn()?;

        let sql = format!(
            "SELECT * FROM {} WHERE user_id = ?",
            Integration::sql_table()
        );

        let mut rows = conn.query(&sql, vec![user_id.as_ref()]).await?;

        let mut items = Vec::new();
        while let Some(row) = rows.next().await.unwrap() {
            let item: Integration = libsql::de::from_row(&row).unwrap();
            items.push(item);
        }
        Ok(items)
    }

    pub async fn upsert_integration(
        &self,
        integration: Integration,
    ) -> Result<Integration, crate::Error> {
        let conn = self.conn()?;

        let sql = format!(
            "INSERT INTO {} (
                id,
                user_id,
                nango_integration_id,
                nango_connection_id
            ) VALUES (?, ?, ?, ?)
            ON CONFLICT (user_id, nango_integration_id) DO UPDATE SET
                nango_connection_id = excluded.nango_connection_id
            RETURNING *",
            Integration::sql_table()
        );

        let params = vec![
            integration.id,
            integration.user_id,
            integration.nango_integration_id.into(),
            integration.nango_connection_id,
        ];

        let mut rows = conn.query(&sql, params).await?;
        let row = rows.next().await.unwrap().unwrap();
        let integration: Integration = libsql::de::from_row(&row).unwrap();
        Ok(integration)
    }
}

#[cfg(test)]
mod tests {
    use crate::{tests::setup_db, Account, Integration, User};
    use hypr_nango::NangoIntegration;

    #[tokio::test]
    async fn test_integrations() {
        let db = setup_db().await;

        let account = db
            .upsert_account(Account {
                id: uuid::Uuid::new_v4().to_string(),
                turso_db_name: "yujonglee".to_string(),
                clerk_org_id: Some("org_1".to_string()),
            })
            .await
            .unwrap();

        let user = db
            .upsert_user(User {
                id: uuid::Uuid::new_v4().to_string(),
                account_id: account.id.clone(),
                human_id: uuid::Uuid::new_v4().to_string(),
                timestamp: chrono::Utc::now(),
                clerk_user_id: "21".to_string(),
            })
            .await
            .unwrap();

        let integration = db
            .upsert_integration(Integration {
                id: uuid::Uuid::new_v4().to_string(),
                user_id: user.id.clone(),
                nango_integration_id: NangoIntegration::GoogleCalendar,
                nango_connection_id: uuid::Uuid::new_v4().to_string(),
            })
            .await
            .unwrap();

        assert_eq!(integration.user_id, user.id);
    }
}
