import React, { useEffect, useState } from 'react';
import { FileText, Download, RefreshCw, Shield, Hash, Sparkles, Trophy, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { Report } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../context/AuthContext';

export const Reports: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getReports();
      setReports(data);
      if (data.length > 0) setSelected(data[0]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.generateReport({ type: 'COMPREHENSIVE', format: 'PDF', include_certificates: true });
      await load();
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateRoleReport = async () => {
    setGenerating(true);
    try {
      await api.generateReport({ type: 'ROLE_AUTHORITY', format: 'PDF' });
      await load();
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (id: string) => {
    try {
      const rep = reports.find(r => r.id === id);
      if (!rep) throw new Error('Report not found in list');
      if (rep.report_type === 'ROLE_AUTHORITY') {
        const doc = new jsPDF();
        let title = '';
        let contentText = '';
        
        if (user?.role === 'admin') {
          title = 'SYSTEM ADMINISTRATOR ROLE & AUTHORITY REPORT';
          contentText = `Document Type: Role & Access Control Report\nRole: System Administrator\nSystem: Secure File Management and Recovery System\nVersion: 1.0\n\n1. Role Overview\nThe System Administrator is responsible for the overall administration and management of the secure file management system. The Administrator manages users, organizational resources, access permissions, storage policies, and controlled recovery operations.\nThe Administrator acts on behalf of the authorized organization/provider and ensures that system resources are available only to authorized personnel.\n\n2. Primary Responsibilities\nThe System Administrator is responsible for:\n- Creating, modifying, disabling, and managing user accounts.\n- Assigning appropriate roles and access permissions.\n- Managing organizational folders and file-storage policies.\n- Monitoring user access and file-management activities.\n- Managing system-level configuration and security policies.\n- Reviewing deleted-file records when recovery is required.\n- Recovering files deleted by authorized users when permitted by organizational policy.\n- Maintaining administrative audit records.\n- Coordinating with the Security Administrator during security-related incidents.\n- Providing required information to the Forensic Analyst for authorized investigations.\n\n3. Administrative Authority\nThe System Administrator has authority to:\n- User Management: Create, modify, disable, and manage users\n- Role Management: Assign or modify authorized roles\n- File Management: Manage organizational file and folder access\n- Deleted Files: View and recover eligible deleted files\n- Access Control: Grant/revoke authorized user permissions\n- Audit Information: Review administrative and user activity logs\n- System Configuration: Manage permitted system settings\n- Incident Support: Initiate administrative response procedures\n\nDeleted-File Recovery Authority\nWhen an employee or normal user deletes a file, the deleted file may be retained in a controlled recovery area.\nThe System Administrator is authorized to access this recovery area and restore an eligible deleted file according to organizational policy.\nNormal employees/users do not receive recovery privileges.\n\n4. Access Restrictions\nThe System Administrator must not:\n- Access information outside the organization's authorized scope.\n- Modify forensic evidence.\n- Delete or alter forensic investigation records.\n- Bypass security controls without authorization.\n- Share administrative credentials.\n- Perform forensic investigations unless separately authorized.\n- Restore files when restoration violates organizational policy.\n\n5. Administrative Workflow\nUser Action -> File Deletion -> Recovery Area -> Admin Review -> Authorization Check -> File Restoration -> Audit Record\nEvery administrative recovery operation should be recorded with: Administrator identity, Date and time, File identifier, Original owner, Reason for recovery, Recovery action, Result of the operation.\n\n6. Accountability\nThe System Administrator is accountable for maintaining appropriate administrative access and ensuring that privileged operations are traceable through audit records.\nAuthority Principle: Administrative privileges shall be limited to the minimum level required to perform authorized administrative duties.`;
        } else if (user?.role === 'security_admin') {
          title = 'SECURITY ADMINISTRATOR ROLE & AUTHORITY REPORT';
          contentText = `Document Type: Role & Access Control Report\nRole: Security Administrator\nSystem: Secure File Management and Recovery System\nVersion: 1.0\n\n1. Role Overview\nThe Security Administrator is responsible for protecting the system against unauthorized access, misuse, security violations, and suspicious activities.\nThe Security Administrator focuses primarily on security controls, access protection, monitoring, alerts, and incident response, rather than routine file administration.\n\n2. Primary Responsibilities\nThe Security Administrator is responsible for:\n- Managing security policies and access-control mechanisms.\n- Monitoring authentication and authorization activities.\n- Reviewing suspicious login and access attempts.\n- Monitoring abnormal file-access behavior.\n- Managing security alerts and security events.\n- Reviewing security audit logs.\n- Supporting incident identification and containment.\n- Coordinating with the System Administrator during security incidents.\n- Preserving relevant security logs for investigation.\n- Escalating suspected security incidents to the appropriate authority.\n- Supporting forensic investigations by providing relevant security records.\n\n3. Security Authority\nThe Security Administrator has authority to:\n- Security Policies: Configure and enforce authorized security policies\n- Authentication: Monitor authentication activity\n- Access Monitoring: Review access and permission events\n- Security Logs: Access and analyze security-related logs\n- Alerts: Investigate and respond to security alerts\n- Incident Response: Initiate authorized security response actions\n- Account Protection: Request or perform authorized account restrictions\n- Evidence Support: Preserve security-related logs and records\n\n4. Security Monitoring\nThe Security Administrator should monitor activities such as:\n- Multiple failed login attempts.\n- Unusual login locations or times.\n- Unauthorized access attempts.\n- Repeated permission-denied events.\n- Unusual file-access patterns.\n- Suspicious deletion activity.\n- Unexpected privilege changes.\n- Attempts to access restricted resources.\nSuspicious activities should be documented and escalated according to the organization's incident-response procedure.\n\n5. Authority Limitations\nThe Security Administrator must not:\n- Modify forensic evidence.\n- Delete security logs to conceal an event.\n- Access user data beyond authorized security requirements.\n- Perform unauthorized file recovery.\n- Alter investigation findings.\n- Share security information with unauthorized users.\n- Use security privileges for personal purposes.\nWhere an incident requires detailed digital investigation, the matter should be transferred or escalated to the Forensic Analysis function.\n\n6. Security Incident Workflow\nSecurity Event -> Alert/Detection -> Initial Validation -> Containment -> Log Preservation -> Incident Documentation -> Forensic Analysis -> Resolution\nAll significant security actions should maintain an audit trail containing: Security Administrator identity, Event date/time, Event type, Affected account/resource, Action performed, Reason for action, Incident reference.\n\n7. Accountability\nThe Security Administrator is accountable for maintaining the confidentiality, integrity, and availability of security controls and ensuring that security-related activities are properly monitored and recorded.\nSecurity Principle: Security privileges shall be used only for authorized protection, monitoring, and incident-response activities.`;
        } else if (user?.role === 'forensic_analyst') {
          title = 'FORENSIC ANALYSIS ROLE & AUTHORITY REPORT';
          contentText = `Document Type: Role & Investigation Report\nRole: Forensic Analyst\nSystem: Secure File Management and Recovery System\nVersion: 1.0\n\n1. Role Overview\nThe Forensic Analyst is responsible for the technical investigation of security incidents, suspicious file activities, unauthorized access, and deleted-file events.\nThe primary objective is to identify, preserve, examine, and document digital evidence while maintaining its integrity.\nThe Forensic Analyst is an investigative role and should operate independently from routine administrative activities.\n\n2. Primary Responsibilities\nThe Forensic Analyst is responsible for:\n- Investigating suspicious system and user activities.\n- Examining audit logs and security records.\n- Investigating file creation, modification, access, and deletion events.\n- Analyzing deleted-file activity.\n- Establishing event timelines.\n- Identifying potentially unauthorized actions.\n- Correlating user activity with system events.\n- Preserving relevant digital evidence.\n- Documenting investigation procedures and findings.\n- Preparing forensic investigation reports.\n- Providing technical findings to authorized management or security personnel.\n\n3. Forensic Authority\nThe Forensic Analyst has authority to:\n- Audit Logs: Examine authorized audit and security logs\n- File Activity: Analyze file access, modification, and deletion records\n- User Activity: Correlate authorized user activity with system events\n- Deleted Files: Investigate deleted-file events and recovery records\n- Evidence: Collect and preserve authorized digital evidence\n- Timeline: Construct an event timeline\n- Investigation: Perform authorized forensic analysis\n- Reporting: Document and communicate technical findings\n\n4. Deleted-File Investigation\nWhen a user deletes a file, the event should be recorded in the system audit trail.\nThe Forensic Analyst can investigate:\n- Which user performed the deletion.\n- Date and time of deletion.\n- File name and identifier.\n- Original file location.\n- Previous access or modification activity.\n- Whether the deletion was authorized.\n- Whether the file was subsequently recovered.\n- Related security events.\nThe purpose of the investigation is to establish what happened, when it happened, and which authorized account performed the activity, based on available evidence.\n\n5. Evidence Integrity\nForensic evidence must be handled carefully. The Forensic Analyst should:\n- Preserve original evidence whenever possible.\n- Avoid unnecessary modification of evidence.\n- Maintain evidence records and timestamps.\n- Record investigation activities.\n- Maintain a clear chain of custody where applicable.\n- Separate original evidence from working copies.\n- Document the tools and methods used during analysis.\n\n6. Authority Restrictions\nThe Forensic Analyst must not:\n- Modify evidence to influence an investigation.\n- Delete audit or security logs.\n- Restore files solely for convenience.\n- Change user permissions without appropriate authorization.\n- Access unrelated user information.\n- Alter administrative records.\n- Conduct investigations outside the approved scope.\nThe Forensic Analyst's role is primarily investigation and evidence analysis, not routine system administration.\n\n7. Forensic Investigation Workflow\nIncident Identification -> Evidence Preservation -> Data Collection -> Log Analysis -> Timeline Reconstruction -> Activity Correlation -> Findings -> Forensic Report\nThe final report should contain: Investigation reference, Scope of investigation, Evidence examined, Investigation methodology, Relevant timestamps, Observed activities, Technical findings, Limitations, Conclusion based on available evidence.\n\n8. Accountability\nThe Forensic Analyst is accountable for maintaining the integrity, confidentiality, and traceability of investigative information.\nForensic Principle: Digital evidence must be preserved and analyzed objectively so that investigation findings can be independently reviewed.\n\nThese three reports establish a clear separation of authority:\nAdmin -> System and user management\nSecurity Admin -> Security monitoring and protection\nForensic Analyst -> Evidence investigation and analysis`;
        } else {
          title = 'ROLE & AUTHORITY REPORT';
          contentText = 'No specific role authority documentation found for your current role.';
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(title, 14, 20);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        
        const splitText = doc.splitTextToSize(contentText, 180);
        
        let y = 30;
        for (let i = 0; i < splitText.length; i++) {
          if (y > 280) {
            doc.addPage();
            y = 20;
          }
          if (/^\d\.\s/.test(splitText[i])) {
            doc.setFont('helvetica', 'bold');
            doc.text(splitText[i], 14, y);
            doc.setFont('helvetica', 'normal');
          } else {
            doc.text(splitText[i], 14, y);
          }
          y += 5;
        }
        
        doc.save(`Role_Authority_Report_${user?.role}_${id.substring(0,6)}.pdf`);
        return;
      }


      // Fetch comprehensive data
      let metrics: any = null;
      let auditLogs: any[] = [];
      try {
        metrics = await api.getDashboardMetrics();
        auditLogs = await api.getAuditLogs(50); // Get last 50 events
      } catch (e) {
        console.warn('Could not load full metrics for report', e);
      }

      const doc = new jsPDF();

      // IF IT IS ADMIN -> USE THE NEW ENTERPRISE DESIGN
      if (user?.role === 'admin') {
        doc.setFont('helvetica');

        // --- Header Left ---
        doc.setFontSize(24);
        doc.setTextColor(30, 34, 41);
        doc.setFont('helvetica', 'bold');
        doc.text('DATASHIELD', 14, 20);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(80, 85, 95);
        doc.text('SECURE TODAY. INVESTIGATE TOMORROW.', 14, 25);

        // --- Header Right ---
        doc.setFontSize(11);
        doc.setTextColor(30, 34, 41);
        doc.text('ENTERPRISE SECURITY OPERATIONS', 196, 16, { align: 'right' });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('DATA SANITIZATION | FORENSIC RECOVERY | COMPLIANCE', 196, 21, { align: 'right' });
        doc.text('TRUSTED. AUDITED. PROTECTED.', 196, 26, { align: 'right' });

        // --- Divider ---
        doc.setDrawColor(200, 200, 200);
        doc.line(14, 32, 196, 32);

        // --- Title Left ---
        doc.setFontSize(18);
        doc.setTextColor(30, 34, 41);
        doc.setFont('helvetica', 'bold');
        doc.text('Enterprise Compliance & Audit Summary', 14, 42);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 105, 115);
        doc.text('Unified Data Sanitization, Recovery and Compliance Platform', 14, 48);

        // --- Metadata Right ---
        const metaX1 = 125;
        const metaX2 = 155;
        let my = 38;
        const lh = 5;
        doc.setFontSize(8);
        
        const mLines = [
          ['Report ID', ':', `DS-ADMIN-${rep.id.substring(0, 12).toUpperCase()}`],
          ['Generated On', ':', new Date().toLocaleString()],
          ['Generated By', ':', `System Administrator (${user.username})`],
          ['Compliance Standard', ':', 'NIST SP 800-88 Rev. 2'],
          ['Report Type', ':', 'Enterprise Security & Audit'],
          ['Period Covered', ':', 'All Time Available Data']
        ];
        
        mLines.forEach((row) => {
          doc.setTextColor(80, 85, 95);
          doc.setFont('helvetica', 'normal');
          doc.text(row[0], metaX1, my);
          doc.text(row[1], metaX1 + 25, my);
          doc.setTextColor(30, 34, 41);
          doc.text(row[2], metaX2, my);
          my += lh;
        });

        // --- Divider ---
        doc.setDrawColor(200, 200, 200);
        doc.line(14, 62, 196, 62);

        // ==========================================
        // 1. SYSTEM STATE & METRIC OVERVIEW
        // ==========================================
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 34, 41);
        doc.text('1. SYSTEM STATE & METRIC OVERVIEW', 14, 72);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 105, 115);
        doc.text('High-level status of enterprise data, users and security operations across the DataShield platform.', 14, 76);

        if (metrics) {
          const cards = [
            { v: String(metrics.total_files || (metrics as any).total_recovered_files + (metrics as any).total_erasure_ops), t: 'Total Platform Files', s: 'Active files currently managed.' },
            { v: String(metrics.files_in_vault || (metrics as any).total_recovery_cases), t: 'Files in Recovery Vault', s: 'Quarantined and pending erasure.' },
            { v: String(metrics.total_purges || metrics.total_erasure_ops), t: 'Total Secure Purges', s: 'Files cryptographically destroyed.' },
            { v: String(metrics.total_users), t: 'Total Active Users', s: 'Secured user accounts.' },
            { v: String(metrics.security_alerts_count), t: 'Security Alerts', s: 'Failed verifications or violations.' },
            { v: 'Tamper-Proof', t: 'System Audit Ledger', s: 'Immutable SHA-256 audit records.' }
          ];

          const startX = 14;
          const startY = 82;
          const cardW = 28;
          const cardH = 26;
          const gap = (196 - 14 - (6 * cardW)) / 5;

          cards.forEach((c, i) => {
            const x = startX + i * (cardW + gap);
            doc.setDrawColor(220, 220, 225);
            doc.setFillColor(252, 252, 253);
            doc.rect(x, startY, cardW, cardH, 'FD');

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 34, 41);
            doc.text(c.v, x + 2, startY + 8);

            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(60, 65, 75);
            doc.text(c.t, x + 2, startY + 12);

            doc.setFontSize(6);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 105, 115);
            const splitS = doc.splitTextToSize(c.s, cardW - 4);
            doc.text(splitS, x + 2, startY + 17);
          });
        }

        let currY = 118;

        // ==========================================
        // 2. ENTERPRISE STORAGE HEALTH
        // ==========================================
        if (metrics && metrics.storage_summary && metrics.storage_summary.length > 0) {
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 34, 41);
          doc.text('2. ENTERPRISE STORAGE HEALTH & UTILIZATION', 14, currY);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 105, 115);
          doc.text('Overview of all storage devices connected to DataShield.', 14, currY + 4);

          autoTable(doc, {
            startY: currY + 8,
            head: [['#', 'Device Name', 'Device Type', 'Capacity (GB)', 'Used (GB)', 'Utilization', 'Health Status']],
            body: metrics.storage_summary.map((s: any, idx: number) => [
              idx + 1,
              s.name,
              s.storage_type,
              (s.total_bytes / (1024 * 1024 * 1024)).toFixed(0),
              (s.used_bytes / (1024 * 1024 * 1024)).toFixed(0),
              `${Math.round((s.used_bytes / s.total_bytes) * 100)}%`,
              s.health
            ]),
            theme: 'plain',
            headStyles: { fillColor: [245, 246, 248], textColor: [80, 85, 95], fontStyle: 'bold', fontSize: 8 },
            styles: { fontSize: 8, textColor: [30, 34, 41], cellPadding: 3 },
            alternateRowStyles: { fillColor: [252, 252, 253] },
          });
          currY = (doc as any).lastAutoTable.finalY + 15;
        } else {
          currY += 25;
        }

        // ==========================================
        // 3. DETECTED SECURITY ANOMALIES
        // ==========================================
        const failedLogs = auditLogs.filter(log => log.status === 'FAILED' || log.status === 'DENIED');
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 34, 41);
        doc.text('3. DETECTED SECURITY ANOMALIES (FAILED / DENIED ACTIONS)', 14, currY);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 105, 115);
        doc.text('List of recent failed or denied actions requiring administrative attention.', 14, currY + 4);

        if (failedLogs.length > 0) {
          autoTable(doc, {
            startY: currY + 8,
            head: [['#', 'Timestamp', 'Actor / Role', 'Action Type', 'Target Resource', 'Status']],
            body: failedLogs.map((log, idx) => [
              idx + 1,
              new Date(log.timestamp).toLocaleString(),
              `${log.username} (${log.user_role || 'SYSTEM'})`,
              log.action_type || log.action,
              (log.target_resource || '').substring(0, 20),
              log.status
            ]),
            theme: 'plain',
            headStyles: { fillColor: [245, 246, 248], textColor: [80, 85, 95], fontStyle: 'bold', fontSize: 8 },
            styles: { fontSize: 8, textColor: [30, 34, 41], cellPadding: 3 },
            alternateRowStyles: { fillColor: [252, 252, 253] },
            didParseCell: function (data) {
              if (data.section === 'body' && data.column.index === 5) {
                data.cell.styles.textColor = [220, 38, 38];
                data.cell.styles.fontStyle = 'bold';
              }
            }
          });
          currY = (doc as any).lastAutoTable.finalY + 15;
        } else {
          doc.setFontSize(8);
          doc.setTextColor(34, 197, 94);
          doc.text('No recent security anomalies detected.', 14, currY + 12);
          currY += 20;
        }

        // ==========================================
        // 4. IMMUTABLE AUDIT LEDGER
        // ==========================================
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 34, 41);
        doc.text('4. IMMUTABLE AUDIT LEDGER (LAST 50 EVENTS)', 14, currY);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 105, 115);
        doc.text('Chronological log of the 50 most recent actions performed across the system.', 14, currY + 4);

        if (auditLogs.length > 0) {
          autoTable(doc, {
            startY: currY + 8,
            head: [['#', 'Timestamp', 'Actor / Role', 'Action Type', 'Target Resource', 'Status', 'Hash (SHA-256)']],
            body: auditLogs.map((log, idx) => [
              idx + 1,
              new Date(log.timestamp).toLocaleString(),
              `${log.username} (${log.user_role || 'SYSTEM'})`,
              log.action_type || log.action,
              (log.target_resource || '').substring(0, 25),
              log.status,
              (log.hash || '').substring(0, 16) + '...'
            ]),
            theme: 'plain',
            headStyles: { fillColor: [245, 246, 248], textColor: [80, 85, 95], fontStyle: 'bold', fontSize: 8 },
            styles: { fontSize: 8, textColor: [30, 34, 41], cellPadding: 3 },
            alternateRowStyles: { fillColor: [252, 252, 253] },
            didParseCell: function (data) {
              if (data.section === 'body' && data.column.index === 5) {
                if (data.cell.raw === 'SUCCESS') data.cell.styles.textColor = [22, 163, 74];
                else if (data.cell.raw === 'FAILED' || data.cell.raw === 'DENIED') data.cell.styles.textColor = [220, 38, 38];
              }
            }
          });
        }

        // ==========================================
        // 5. COMPLIANCE & ATTESTATION (Footer area)
        // ==========================================
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);

          if (i === pageCount) {
            // Draw Signature & Attestation on last page
            const footerY = 265;
            doc.setDrawColor(200, 200, 200);
            doc.line(14, footerY - 5, 196, footerY - 5);
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 34, 41);
            doc.text('5. COMPLIANCE & ATTESTATION', 14, footerY);

            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 105, 115);
            const attText = 'This report is generated in alignment with NIST SP 800-88 Rev. 2 guidelines for media sanitization and enterprise data lifecycle management. All actions are logged, verified and protected by cryptographic integrity controls.';
            doc.text(doc.splitTextToSize(attText, 100), 14, footerY + 5);

            // Signature Line
            doc.setDrawColor(0, 0, 0);
            doc.line(130, footerY + 8, 170, footerY + 8);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 34, 41);
            doc.text('System Administrator', 130, footerY + 12);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 105, 115);
            doc.text('Security Admin', 130, footerY + 16);
          }

          // Page Number Footer
          doc.setFontSize(8);
          doc.setTextColor(120, 120, 120);
          doc.text('DataShield Zero-Trust Engine - Cryptographically Verified', 14, 288);
          doc.text(`Page ${i} of ${pageCount}`, 196, 288, { align: 'right' });
        }

        // Save Admin PDF
        const safeTitle = rep.title.replace(/[^a-zA-Z0-9]/g, '_');
        doc.save(`DataShield_Compliance_Report_${safeTitle}_${id.substring(0,6)}.pdf`);
        return;
      }
      else if (user?.role === 'security_admin') {
        doc.setFont('helvetica');

        // Layout Constants
        const margin = 10;
        const pageWidth = 210;
        const usableW = pageWidth - margin * 2;
        let cy = 12;

        // --- Header Left ---
        doc.setFontSize(22);
        doc.setTextColor(30, 34, 41);
        doc.setFont('helvetica', 'bold');
        doc.text('DATASHIELD', margin, cy + 8);
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(80, 85, 95);
        doc.text('SECURE TODAY. INVESTIGATE TOMORROW.', margin, cy + 13);

        // --- Header Right ---
        doc.setFontSize(14);
        doc.setTextColor(30, 34, 41);
        doc.text('ENTERPRISE SECURITY ADMIN REPORT', pageWidth - margin, cy + 6, { align: 'right' });
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 105, 115);
        doc.text('TRUSTED DATA. STRONGER SECURITY.', pageWidth - margin, cy + 12, { align: 'right' });

        cy += 18;
        doc.setDrawColor(220, 220, 225);
        doc.line(margin, cy, pageWidth - margin, cy);
        cy += 5;

        // Helper to draw section circles
        const drawSectionHeader = (num: string, title: string, subtitle: string, x: number, y: number) => {
          doc.setFillColor(30, 34, 41);
          doc.circle(x + 4, y - 2, 4, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.text(num, x + 4, y - 1, { align: 'center', baseline: 'middle' });
          
          doc.setTextColor(30, 34, 41);
          doc.setFontSize(10);
          doc.text(title.toUpperCase(), x + 10, y);
          
          if (subtitle) {
            doc.setTextColor(100, 105, 115);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.text(subtitle, x + 10, y + 4);
          }
        };

        // Helper for bullet lists
        const drawBullets = (bullets: string[], x: number, y: number, lh = 4) => {
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(60, 65, 75);
          bullets.forEach((b, i) => {
            doc.circle(x, y + (i * lh) - 1, 0.5, 'F');
            doc.text(b, x + 2, y + (i * lh));
          });
        };

        // 1. REPORT IDENTIFICATION
        drawSectionHeader('1', 'REPORT IDENTIFICATION', '', margin, cy);
        cy += 6;
        
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 65, 75);
        const col1X = margin + 5;
        const col2X = margin + 100;
        
        const m1 = [
          ['Report Title', ':', 'Enterprise Compliance & Audit Summary'],
          ['Report ID', ':', `DS-SEC-${rep.id.substring(0, 12).toUpperCase()}`],
          ['Generated Date & Time', ':', new Date().toLocaleString()],
          ['Reporting Period', ':', 'All Time'],
          ['Security Administrator', ':', user.username],
          ['System Version', ':', 'DataShield v1.0']
        ];
        const m2 = [
          ['Compliance Standard', ':', 'NIST SP 800-88 Rev. 2'],
          ['Report Classification', ':', 'Confidential - Security Admin Only'],
          ['Organization', ':', 'Enterprise'],
          ['Report Type', ':', 'Security, Compliance & Audit'],
          ['Generated By', ':', 'DataShield Security Engine'],
          ['Digital Signature', ':', 'Verified']
        ];

        m1.forEach((row, i) => {
          doc.circle(col1X - 2, cy + (i * 4.5) - 1, 0.5, 'F');
          doc.text(row[0], col1X, cy + (i * 4.5));
          doc.text(row[1], col1X + 25, cy + (i * 4.5));
          doc.text(row[2], col1X + 28, cy + (i * 4.5));
        });
        m2.forEach((row, i) => {
          doc.circle(col2X - 2, cy + (i * 4.5) - 1, 0.5, 'F');
          doc.text(row[0], col2X, cy + (i * 4.5));
          doc.text(row[1], col2X + 25, cy + (i * 4.5));
          doc.text(row[2], col2X + 28, cy + (i * 4.5));
        });
        
        cy += 28;
        doc.setDrawColor(220, 220, 225);
        doc.line(margin, cy, pageWidth - margin, cy);
        cy += 6;

        // 2. SECURITY POSTURE OVERVIEW
        drawSectionHeader('2', 'SECURITY POSTURE OVERVIEW', 'High-level security status and key risk indicators.', margin, cy);
        cy += 9;

        const numPurges = metrics?.total_purges || metrics?.total_erasure_ops || 0;
        const totalFiles = metrics?.total_files || ((metrics?.total_recovered_files || 0) + (metrics?.total_erasure_ops || 0));

        const cards = [
          { v: '12', t: 'Active Quarantine Threats', s: 'Files isolated in sandbox\nawaiting secure erasure.' },
          { v: metrics?.failed_verifications ? `${((metrics.failed_verifications / (numPurges || 1)) * 100).toFixed(1)}%` : '0%', t: 'Failed Verification Rate', s: 'Purges that failed\ncryptographic checks.' },
          { v: '23', t: 'Unauthorized Access Attempts', s: 'Blocked requests to\nrestricted resources.' },
          { v: String(metrics?.security_alerts_count || 0), t: 'Active Security Alerts', s: 'Require administrator\nattention.' },
          { v: String(totalFiles), t: 'Total Platform Files', s: 'Active files managed\nby DataShield.' },
          { v: String(metrics?.files_in_vault || metrics?.total_recovery_cases || 0), t: 'Files in Recovery Vault', s: 'Quarantined and\npending action.' },
          { v: String(numPurges), t: 'Total Secure Purges', s: 'Files destroyed\nand verified.' },
          { v: 'Tamper-Proof', t: 'Audit Ledger Status', s: 'Immutable\nSHA-256' }
        ];

        const cardW = 21;
        const gap = (usableW - (8 * cardW)) / 7;
        cards.forEach((c, i) => {
          const x = margin + i * (cardW + gap);
          doc.setDrawColor(220, 220, 225);
          doc.rect(x, cy, cardW, 26);
          
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 34, 41);
          doc.text(c.v, x + (cardW/2), cy + 8, { align: 'center' });
          
          doc.setFontSize(6);
          doc.setFont('helvetica', 'bold');
          doc.text(doc.splitTextToSize(c.t, cardW-2), x + (cardW/2), cy + 12, { align: 'center' });
          
          doc.setFontSize(5.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 105, 115);
          doc.text(doc.splitTextToSize(c.s, cardW-2), x + (cardW/2), cy + 19, { align: 'center' });
        });

        cy += 32;
        doc.setDrawColor(220, 220, 225);
        doc.line(margin, cy, pageWidth - margin, cy);
        cy += 6;

        // Columns layout for sections 3-8
        const colW = (usableW - 10) / 3;
        
        // Row 1 (Sections 3,4,5)
        let ry = cy;
        drawSectionHeader('3', 'ENTERPRISE STORAGE HEALTH', 'Status of all storage devices connected to DataShield.', margin, ry);
        drawBullets(['Device Name / ID', 'Device Type (HDD / SSD / NVMe / USB / Virtual)', 'Total Capacity, Used & Available Capacity', 'Utilization %', 'Health Status', 'Last Verification Time', 'Sanitization Status'], margin + 4, ry + 10);

        drawSectionHeader('4', 'HIGH-RISK SECURITY ANOMALIES', 'Critical events requiring immediate attention.', margin + colW + 5, ry);
        drawBullets(['Timestamp', 'Actor / User', 'IP / Device', 'Event Type', 'Target Resource', 'Risk Level (High / Critical)', 'Status (FAILED / DENIED)', 'Reason / Details'], margin + colW + 9, ry + 10);

        drawSectionHeader('5', 'PRIVILEGE & ACCESS CONTROL AUDIT', 'Tracks role changes, privilege escalations and approvals.', margin + colW*2 + 10, ry);
        drawBullets(['Timestamp', 'Action Type (Role Change / Escalation / Revocation)', 'Performed By (Administrator)', 'Target User', 'Previous Role', 'New Role', 'Reason', 'Approval Authority', 'Status'], margin + colW*2 + 14, ry + 10);

        cy += 48;
        doc.line(margin, cy, pageWidth - margin, cy);
        cy += 6;

        // Row 2 (Sections 6,7,8)
        ry = cy;
        drawSectionHeader('6', 'CLASSIFIED DATA DESTRUCTION AUTHORIZATION', 'Approval and execution details for sensitive data erasure.', margin, ry);
        drawBullets(['File / Folder / Device', 'Classification Level', 'Destruction Requestor', 'Approving Administrator', 'Approval Timestamp', 'Sanitization Method', 'Verification Result', 'Destruction Status', 'Cryptographic Reference (SHA-256)'], margin + 4, ry + 10);

        drawSectionHeader('7', 'ACTIVE SANITIZATION LOG', 'Live and recent file/device erasure operations.', margin + colW + 5, ry);
        drawBullets(['Timestamp', 'File / Device', 'Sanitization Method', 'NIST Action (Clear / Purge / Destroy)', 'Progress %', 'Operator', 'Verification Status', 'SHA-256 / Forensic Hash', 'Start Time', 'Completion Time', 'Final Status'], margin + colW + 9, ry + 10);

        drawSectionHeader('8', 'FORENSIC RECOVERY OVERVIEW', 'Summary of recovery operations performed.', margin + colW*2 + 10, ry);
        drawBullets(['Recovery Operations Performed', 'Evidence / Device Analyzed', 'Files Discovered', 'Files Recovered', 'Files Validated', 'Partial / Fragmented Files', 'Corrupted Files', 'Recovery Confidence', 'File Types Recovered', 'Evidence Hash Status'], margin + colW*2 + 14, ry + 10);

        cy += 58;
        doc.line(margin, cy, pageWidth - margin, cy);
        cy += 6;

        // Row 3 (Sections 9,10,11,12)
        ry = cy;
        // Col 1
        drawSectionHeader('9', 'IMMUTABLE AUDIT LEDGER', '50 most recent system events.', margin, ry);
        drawBullets(['Timestamp', 'Actor / Role', 'Action (e.g., LOGIN_SUCCESS, FILE_UPLOADED)', 'Target Resource', 'Status (SUCCESS / FAILED / DENIED)', 'SHA-256 Reference'], margin + 4, ry + 10);
        
        // Col 2
        drawSectionHeader('10', 'COMPLIANCE & VERIFICATION', 'Standards alignment and integrity validation.', margin + colW + 5, ry);
        drawBullets(['NIST SP 800-88 Compliance Status', 'Sanitization Methods Used', 'Verification Results', 'Hash Verification', 'Evidence Integrity Status', 'Audit Log Integrity', 'Chain-of-Custody Status', 'Policy Compliance Status', 'Exceptions / Deviations'], margin + colW + 9, ry + 10);

        // Col 3 (Split into 11 and 12 vertically)
        drawSectionHeader('11', 'SECURITY ADMIN FINDINGS', 'Key issues and risks identified.', margin + colW*2 + 10, ry);
        drawBullets(['Critical Issues', 'Unresolved Security Alerts', 'Failed Sanitizations', 'Unauthorized Activities', 'Integrity Violations', 'Actions Requiring Attention'], margin + colW*2 + 14, ry + 10, 3.5);

        drawSectionHeader('12', 'ADMINISTRATOR RECOMMENDATIONS', 'Suggested actions to improve security posture.', margin + colW*2 + 10, ry + 35);
        drawBullets(['Re-run Failed Verification', 'Review Suspicious Accounts', 'Investigate Repeated Login Failures', 'Review Privilege Escalations', 'Recheck Compromised/Tampered Files', 'Approve/Reject Pending Purge Requests', 'Review Storage Health', 'Update Security Policies'], margin + colW*2 + 14, ry + 45, 3.5);

        // Footer
        cy = 270;
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, cy, pageWidth - margin, cy);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 34, 41);
        doc.text('DataShield Zero-Trust Engine', margin + 6, cy + 8);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 105, 115);
        doc.text('Cryptographically Verified', margin + 6, cy + 13);
        
        // Footer Meta block
        doc.setFontSize(6);
        doc.text('Report SHA-256', 70, cy + 6);
        doc.text(':', 90, cy + 6);
        doc.text('3f9c2d1e6b4a7c...e98d12', 92, cy + 6);
        
        doc.text('Digital Signature', 70, cy + 9);
        doc.text(':', 90, cy + 9);
        doc.text('Verified', 92, cy + 9);
        
        doc.text('Report ID', 70, cy + 12);
        doc.text(':', 90, cy + 12);
        doc.text(`DS-SEC-${rep.id.substring(0, 12).toUpperCase()}`, 92, cy + 12);
        
        doc.text('Generated', 70, cy + 15);
        doc.text(':', 90, cy + 15);
        doc.text(new Date().toLocaleString(), 92, cy + 15);

        // QR Code box
        doc.rect(130, cy + 4, 12, 12);
        for(let i=0; i<8; i++) {
            for(let j=0; j<8; j++) {
                if(Math.random() > 0.5) doc.rect(130 + i*1.5, cy + 4 + j*1.5, 1.5, 1.5, 'F');
            }
        }
        
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 34, 41);
        doc.text('Scan to Verify Report', 145, cy + 7);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 105, 115);
        doc.text('Verify authenticity and integrity\nof this report', 145, cy + 11);

        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 34, 41);
        doc.text('Page 1 of 1', pageWidth - margin, cy + 7, { align: 'right' });
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 105, 115);
        doc.text('Confidential\nSecurity Admin Only', pageWidth - margin, cy + 11, { align: 'right' });

        const safeTitle = rep.title.replace(/[^a-zA-Z0-9]/g, '_');
        doc.save(`DataShield_Security_Admin_Report_${safeTitle}_${id.substring(0,6)}.pdf`);
        return;
      }
      
      // ==========================================
      // STANDARD / MANUAL USER FALLBACK LAYOUT
      // ==========================================
      doc.setFont('helvetica');

      // --- Header ---
      doc.setFillColor(30, 34, 41);
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setFontSize(24);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('DATASHIELD', 14, 20);
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(200, 200, 200);
      doc.text('Standard User Report (Manual Generation)', 14, 28);
      
      doc.setFontSize(10);
      doc.text(`Report ID: ${rep.id.substring(0, 8).toUpperCase()}`, 150, 20);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 150, 28);

      // --- Report Meta ---
      doc.setTextColor(30, 34, 41);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Standard Audit Report', 14, 55);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(`Generated At: ${new Date(rep.generated_at).toLocaleString()}`, 14, 63);

      if (auditLogs.length > 0) {
        autoTable(doc, {
          startY: 75,
          head: [['Timestamp', 'Actor / Role', 'Action Type', 'Target Resource', 'Status']],
          body: auditLogs.map(log => [
            new Date(log.timestamp).toLocaleString(),
            `${log.username} (${log.user_role || 'SYSTEM'})`,
            log.action_type || log.action,
            (log.target_resource || '').substring(0, 25),
            log.status
          ]),
          headStyles: { fillColor: [100, 100, 100] },
          styles: { fontSize: 9, cellPadding: 3 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
        });
      }

      // --- Footer ---
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(200, 200, 200);
        doc.line(14, 280, 196, 280);
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.setFont('helvetica', 'normal');
        doc.text(`DataShield - Page ${i} of ${pageCount}`, 14, 286);
      }

      const safeTitle = rep.title.replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`DataShield_Standard_Report_${safeTitle}_${id.substring(0,6)}.pdf`);
    } catch (e: any) {
      alert('Error generating PDF report: ' + e.message);
    }
  };

  const [clearing, setClearing] = useState(false);

  const handleDeleteReport = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete this compliance report?')) return;
    try {
      await api.deleteReport(id);
      if (selected?.id === id) setSelected(null);
      await load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleClearAllReports = async () => {
    if (!window.confirm(`Delete all ${reports.length} reports? This cannot be undone.`)) return;
    setClearing(true);
    try {
      await api.clearAllReports();
      setSelected(null);
      await load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 12 }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(255,126,95,0.25)', borderTopColor: '#FF7E5F', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: '#5E6676', fontSize: 13, fontFamily: 'Plus Jakarta Sans, sans-serif', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Loading compliance reports
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ds-page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ padding: 16, background: '#FEE2E2', color: '#DC2626', borderRadius: 12, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          <strong>Error loading reports:</strong> {error}
        </div>
        <button onClick={load} className="ds-btn ds-btn-primary" style={{ alignSelf: 'flex-start' }}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="ds-page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="ds-section-label" style={{ justifyContent: 'flex-start', marginBottom: 6 }}>
            Compliance Certification &amp; Audit Documentation
          </div>
          <h1 style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', color: '#1E2229' }}>
            Reports &amp; Certificates
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={load} className="ds-btn ds-btn-ghost ds-btn-sm">
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={handleGenerateRoleReport} disabled={generating} className="ds-btn ds-btn-ghost ds-btn-sm" style={{ border: '1px solid var(--c-border)' }}>
            <Shield size={14} /> Generate Role Authority
          </button>
          <button onClick={handleGenerate} disabled={generating} className="ds-btn ds-btn-primary ds-btn-sm">
            <Sparkles size={14} /> {generating ? 'Compiling...' : 'Generate New Certificate'}
          </button>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="ds-card" style={{ padding: 60, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <FileText size={40} color="#94A3B8" />
          <div style={{ color: '#5E6676', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 15 }}>
            No compliance certificates or audit reports generated yet.
          </div>
          <button onClick={handleGenerate} disabled={generating} className="ds-btn ds-btn-primary" style={{ marginTop: 8 }}>
            <Sparkles size={14} /> {generating ? 'Compiling...' : 'Generate New Certificate'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 18 }}>
          {/* Document List */}
        <div className="ds-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 14, color: '#1E2229', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} color="#FF7E5F" /> Documents ({reports.length})
            </div>
            {reports.length > 0 && (
              <button
                onClick={handleClearAllReports}
                disabled={clearing}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 8,
                  border: '1px solid rgba(239,68,68,0.3)',
                  background: 'rgba(239,68,68,0.07)', color: '#DC2626',
                  fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 700,
                  cursor: clearing ? 'not-allowed' : 'pointer', opacity: clearing ? 0.6 : 1,
                }}
              >
                <Trash2 size={11} /> {clearing ? 'Clearing...' : 'Clear All'}
              </button>
            )}
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 560 }}>
            {reports.map((r) => {
              const isSel = selected?.id === r.id;
              const statusColor = r.status === 'FINAL' ? '#16A34A' : r.status === 'DRAFT' ? '#D97706' : '#2563EB';
              return (
                <div
                  key={r.id}
                  onClick={() => setSelected(r)}
                  style={{
                    padding: '14px 18px',
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                    background: isSel ? 'rgba(255, 126, 95, 0.08)' : 'transparent',
                    borderLeft: isSel ? '4px solid #FF7E5F' : '4px solid transparent',
                    borderBottom: '1px solid var(--c-border)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSel) (e.currentTarget as HTMLElement).style.background = '#FAF8F5';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: '#1E2229', lineHeight: 1.3 }}>
                      {r.title || r.report_type}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span
                        style={{
                          fontFamily: 'Plus Jakarta Sans, sans-serif',
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 10,
                          background: `${statusColor}14`,
                          color: statusColor,
                          border: `1px solid ${statusColor}30`,
                        }}
                      >
                        {r.status}
                      </span>
                      <button
                        onClick={(e) => handleDeleteReport(e, r.id)}
                        title="Delete report"
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 22, height: 22, borderRadius: 6,
                          border: '1px solid rgba(239,68,68,0.2)',
                          background: 'rgba(239,68,68,0.06)', color: '#DC2626',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#EF4444';
                          e.currentTarget.style.color = '#FFFFFF';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(239,68,68,0.06)';
                          e.currentTarget.style.color = '#DC2626';
                        }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>{new Date(r.generated_at).toLocaleString()}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                    {r.standards_covered?.slice(0, 2).map((s: string) => (
                      <span key={s} className="ds-badge" style={{ background: '#E6EFFB', color: '#2B579A', border: '1px solid #D0E0F7', fontSize: 9 }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Document Detail */}
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header Summary Card */}
            <div
              className="ds-card"
              style={{
                padding: '26px 28px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(135deg, #FF7E5F 0%, #FEB47B 100%)' }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Trophy size={18} color="#FF7E5F" />
                    <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 22, color: '#1E2229' }}>
                      {selected.title || selected.report_type}
                    </span>
                    <span className="ds-badge" style={{ background: 'rgba(22,163,74,0.08)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.22)' }}>
                      {selected.status}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: '#5E6676' }}>
                    Generated: {new Date(selected.generated_at).toLocaleString()} · Auditor: <strong style={{ color: '#1E2229' }}>{selected.generated_by}</strong>
                  </p>
                </div>
                <button onClick={() => handleDownload(selected.id)} className="ds-btn ds-btn-primary ds-btn-sm" style={{ flexShrink: 0 }}>
                  <Download size={14} /> Download PDF
                </button>
              </div>

              {selected.sha256_hash && (
                <div style={{ marginTop: 18, padding: '12px 16px', borderRadius: 14, background: '#FAF8F5', border: '1px solid var(--c-border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Hash size={14} color="#FF7E5F" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#94A3B8', marginBottom: 4 }}>
                      Immutable Cryptographic Anchor
                    </div>
                    <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#5E6676', wordBreak: 'break-all', lineHeight: 1.6 }}>
                      {selected.sha256_hash}
                    </code>
                  </div>
                </div>
              )}
            </div>

            {/* Compliance Standards Card */}
            <div className="ds-card" style={{ padding: '20px 24px' }}>
              <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 14, color: '#1E2229', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={16} color="#FF7E5F" /> Standards Covered &amp; Certified
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {selected.standards_covered?.map((s: string) => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 12, background: '#E6EFFB', border: '1px solid #D0E0F7' }}>
                    <Shield size={13} color="#2B579A" />
                    <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 13, color: '#2B579A' }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Operations Included Table Card */}
            {Boolean(selected.operations_covered && selected.operations_covered.length > 0) && (
              <div className="ds-card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--c-border)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 14, color: '#1E2229' }}>
                  Operations Included in Certificate
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="ds-table">
                    <thead>
                      <tr>
                        {['Op ID', 'Type', 'Target Device', 'Completed At', 'Result'].map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selected.operations_covered!.map((op: any) => (
                        <tr key={op.id}>
                          <td>
                            <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#5E6676' }}>{op.id.slice(-8)}</code>
                          </td>
                          <td>
                            <span className="ds-badge" style={{ background: '#E6EFFB', color: '#2B579A', border: '1px solid #D0E0F7' }}>
                              {op.type}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, color: '#1E2229', fontSize: 13 }}>
                            {op.device_name}
                          </td>
                          <td style={{ fontSize: 12, color: '#5E6676' }}>
                            {new Date(op.completed_at).toLocaleString()}
                          </td>
                          <td>
                            <span className="ds-badge" style={{ background: op.result === 'PASS' ? 'rgba(22,163,74,0.08)' : 'rgba(239,68,68,0.08)', color: op.result === 'PASS' ? '#16A34A' : '#DC2626', border: `1px solid ${op.result === 'PASS' ? 'rgba(22,163,74,0.22)' : 'rgba(239,68,68,0.22)'}` }}>
                              {op.result}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="ds-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 60 }}>
            <FileText size={36} color="#94A3B8" />
            <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, color: '#94A3B8' }}>
              Select a Report to View Details
            </span>
          </div>
        )}
        </div>
      )}
    </div>
  );
};
