<div id="page-content" class="page-wrapper clearfix custom_whatsboost">
    <div class="clearfix row">
        <div class="col-md-3">
            <div class="card dashboard-icon-widget">
                <div class="card-body-wp">
                    <div class="widget-icon bg-warning">
                        <i data-feather="book-open" class='icon'></i>
                    </div>
                    <div class="widget-details">
                        <p class="text-uppercase mb-0 fw-bold"><?php echo app_lang('templates'); ?></p>
                        <h6 class="m-2 fw-bold"><?php echo $campaign['template_name']; ?></h6>
                        <span class="fw-normal"> <?php echo $campaign['created_at']; ?></span>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card dashboard-icon-widget">
                <div class="card-body-wp">
                    <div class="widget-icon bg-info">
                        <i data-feather="user" class='icon'></i>
                    </div>
                    <div class="widget-details">
                        <p class="text-uppercase mb-0 fw-bold"><?php echo app_lang($campaign['rel_type']); ?></p>
                        <h6 class="m-2 fw-bold"><?php echo count(wbGetCampaignData($campaign['id'])) ?? '0'; ?></h6>
                        <span class="fw-normal"><?php echo $total_percent; ?>% <?php echo app_lang('of_your').$campaign['rel_type']; ?></span>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card dashboard-icon-widget">
                <div class="card-body-wp">
                    <div class="widget-icon bg-success">
                        <i data-feather="check" class='icon'></i>
                    </div>
                    <div class="widget-details">
                        <p class="text-uppercase mb-0 fw-bold"><?php echo app_lang('delivered_to'); ?></p>
                        <h6 class="m-2 fw-bold"><?php echo $delivered_to_percent.' %'; ?></h6>
                        <span class="fw-normal"><?php echo $delivered_to_count.' '.app_lang($campaign['rel_type']); ?></span>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card dashboard-icon-widget">
                <div class="card-body-wp">
                    <div class="widget-icon bg-secondary">
                        <i data-feather="message-circle" class='icon'></i>
                    </div>
                    <div class="widget-details">
                        <p class="text-uppercase mb-0 fw-bold"><?php echo app_lang('read_by'); ?></p>
                        <h6 class="m-2 fw-bold"><?php echo $read_by_percent.' %'; ?></h6>
                        <span class="fw-normal">
                            <?php echo $read_by_count.' '.app_lang('of_the').' '.$delivered_to_count.' '.$campaign['rel_type'].' '.app_lang('messaged'); ?>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="card">
        <div class="page-title clearfix rounded">
            <h1><?php echo app_lang('campaign_daily_task'); ?></h1>
            <div class="title-button-group">
                <?php
                $feather_icon = (1 == $campaign['pause_campaign']) ? 'play' : 'pause';
                $label        = (1 == $campaign['pause_campaign']) ? app_lang('resume_campaign') : app_lang('pause_campaign');
                ?>
                <a href="javascript:void(0)" id="pause_campaign_btn" class="btn btn-primary"><i data-feather="<?php echo $feather_icon; ?>" class="icon-16"></i><?php echo $label; ?></a>
                <a href="<?php echo get_uri('whatsboost/campaigns'); ?>" class="btn btn-primary"><i data-feather="skip-back" class="icon-16"></i> <?php echo app_lang('back'); ?></a>
            </div>
        </div>
        <div class="table-responsive">
            <table id="campaign_daily_task_table" class="display" cellspacing="0" width="100%">
            </table>
        </div>
    </div>
</div>
<script>
    "use strict";
    $(function() {
        $("#campaign_daily_task_table").appTable({
            source: '<?php echo_uri('whatsboost/dailyTaskTable/'.$campaign['id']); ?>',
            columns: [{
                    title: '<?php echo app_lang('phone'); ?>'
                },
                {
                    title: '<?php echo app_lang('name'); ?>'
                },
                {
                    title: '<?php echo app_lang('message'); ?>'
                },
                {
                    title: '<?php echo app_lang('sent_status'); ?>'
                },
            ],
            printColumns: [0, 1, 2, 3],
            xlsColumns: [0, 1, 2, 3],
            onInitComplete: function() {
                $('[data-bs-toggle="tooltip"]').tooltip();
            }
        });


        $(document).on('click', '#pause_campaign_btn', function(event) {
            event.preventDefault();
            $.ajax({
                url: '<?php echo_uri('whatsboost/campaigns/pause_resume_campaign/'.$campaign['id']); ?>',
                type: 'post',
                dataType: 'json'
            }).done(function(res) {
                appAlert.success(res.message, {
                    duration: 3000
                });
                setTimeout(function() {
                    window.location.href = res.recirect_to;
                }, 3000);
            })
        });

    })
</script>
